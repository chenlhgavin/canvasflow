"""流式处理器 - 处理 LangGraph 的流式输出并转换为 SSE 格式"""

import json
import logging
from typing import Any, AsyncGenerator, Dict, List, Optional

from langchain_core.messages import (
    AIMessage,
    AIMessageChunk,
    HumanMessage,
    ToolMessage,
    convert_to_openai_messages,
)

from canvasflow.config import settings

logger = logging.getLogger(__name__)


class StreamProcessor:
    """流式处理器 - 负责处理智能体的流式输出"""

    def __init__(self, session_id: Optional[str] = None):
        self.session_id = session_id
        self.current_content = ""
        self.current_tool_calls = []
        self.text_buffer = ""
        self.tool_call_args: Dict[str, Dict[str, Any]] = {}
        self.tool_call_names: Dict[str, str] = {}
        self.tool_call_args_buffer: Dict[str, str] = {}
        self.sent_tool_call_ids: set = set()
        self.recursion_limit = settings.recursion_limit

    async def process_stream(self, agent: Any, messages: List[Dict[str, Any]]) -> AsyncGenerator[str, None]:
        """处理整个流式响应"""
        try:
            logger.info(f"开始处理流式响应，消息数量: {len(messages)}")

            # 清理消息历史：过滤空消息，合并连续同角色消息
            cleaned = []
            for msg in messages:
                role = msg.get("role")
                content = (msg.get("content") or "").strip()
                if not content or role not in ("user", "assistant"):
                    continue
                if cleaned and cleaned[-1]["role"] == role:
                    cleaned[-1]["content"] += "\n" + content
                else:
                    cleaned.append({"role": role, "content": content})

            langchain_messages = []
            for msg in cleaned:
                if msg["role"] == "user":
                    langchain_messages.append(HumanMessage(content=msg["content"]))
                else:
                    langchain_messages.append(AIMessage(content=msg["content"]))

            logger.info(f"转换后的消息数量: {len(langchain_messages)} (原始: {len(messages)})")

            chunk_count = 0
            try:
                async for chunk in agent.astream(
                    {"messages": langchain_messages},
                    {"recursion_limit": self.recursion_limit},
                    stream_mode=["messages"],
                ):
                    chunk_count += 1
                    try:
                        async for event in self._handle_chunk(chunk):
                            yield event
                    except (GeneratorExit, StopAsyncIteration, ConnectionError, BrokenPipeError, OSError) as e:
                        logger.info(f"客户端断开连接: {type(e).__name__}")
                        raise
            except (GeneratorExit, StopAsyncIteration, ConnectionError, BrokenPipeError, OSError) as e:
                logger.info(f"客户端断开连接，停止流式处理: {type(e).__name__}")
                return

            if self.text_buffer:
                logger.info(f"AI回答(完): {self.text_buffer}")
                self.text_buffer = ""

            logger.info("流式处理完成")
            yield "data: [DONE]\n\n"

        except Exception as e:
            import traceback

            logger.error(f"流式处理错误: {str(e)}")
            logger.error(traceback.format_exc())
            error_event = {"type": "error", "error": str(e), "traceback": traceback.format_exc()}
            yield f"data: {json.dumps(error_event, ensure_ascii=False)}\n\n"

    async def _handle_chunk(self, chunk: Any) -> AsyncGenerator[str, None]:
        """处理单个 chunk"""
        try:
            if isinstance(chunk, tuple) and len(chunk) == 2:
                chunk_type = chunk[0]
                chunk_data = chunk[1]

                if chunk_type == "values":
                    async for event in self._handle_values_chunk(chunk_data):
                        yield event
                else:
                    if isinstance(chunk_data, list) and len(chunk_data) > 0:
                        for message in chunk_data:
                            async for event in self._handle_message_chunk(message):
                                yield event
                    elif hasattr(chunk_data, "__iter__") and not isinstance(chunk_data, str):
                        for message in chunk_data:
                            async for event in self._handle_message_chunk(message):
                                yield event
                    else:
                        async for event in self._handle_message_chunk(chunk_data):
                            yield event
            elif isinstance(chunk, list) and len(chunk) > 0:
                for message in chunk:
                    async for event in self._handle_message_chunk(message):
                        yield event
            else:
                async for event in self._handle_message_chunk(chunk):
                    yield event
        except Exception as e:
            import traceback

            logger.error(f"处理 chunk 时出错: {str(e)}")
            logger.error(traceback.format_exc())
            error_event = {"type": "error", "error": f"处理chunk时出错: {str(e)}"}
            yield f"data: {json.dumps(error_event, ensure_ascii=False)}\n\n"

    async def _handle_values_chunk(self, chunk_data: Dict[str, Any]) -> AsyncGenerator[str, None]:
        """处理 values 类型的 chunk"""
        all_messages = chunk_data.get("messages", [])
        if all_messages:
            oai_messages = convert_to_openai_messages(all_messages)
            event = {"type": "messages", "messages": oai_messages}
            yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"

    async def _handle_message_chunk(self, message_chunk: Any) -> AsyncGenerator[str, None]:
        """处理消息类型的 chunk"""
        try:
            # 处理工具消息
            if isinstance(message_chunk, ToolMessage):
                logger.info(f"工具调用结果: tool_call_id={message_chunk.tool_call_id}")
                if message_chunk.tool_call_id in self.tool_call_args:
                    del self.tool_call_args[message_chunk.tool_call_id]
                if message_chunk.tool_call_id in self.tool_call_names:
                    del self.tool_call_names[message_chunk.tool_call_id]
                event = {
                    "type": "tool_result",
                    "tool_call_id": message_chunk.tool_call_id,
                    "content": message_chunk.content,
                }
                yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
                return

            # 处理 AI 消息
            if isinstance(message_chunk, AIMessageChunk):
                content = message_chunk.content

                if content is not None and content != "":
                    content_str = str(content) if not isinstance(content, str) else content
                    if content_str:
                        self.text_buffer += content_str
                        if "\n" in self.text_buffer or (
                            len(self.text_buffer) > 50 and any(p in self.text_buffer for p in "。！？.!?")
                        ):
                            log_content = self.text_buffer.replace("\n", " ")
                            if log_content.strip():
                                logger.info(f"AI回答: {log_content}")
                            self.text_buffer = ""

                        event = {"type": "delta", "content": content_str}
                        yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"

                # 处理工具调用
                if hasattr(message_chunk, "tool_calls") and message_chunk.tool_calls:
                    for tool_call in message_chunk.tool_calls:
                        if isinstance(tool_call, dict):
                            tool_call_id = tool_call.get("id")
                            tool_name = tool_call.get("name")
                            tool_args = tool_call.get("args") or tool_call.get("arguments") or {}
                        else:
                            tool_call_id = getattr(tool_call, "id", None)
                            tool_name = getattr(tool_call, "name", None)
                            tool_args = getattr(tool_call, "args", None) or getattr(tool_call, "arguments", None)
                            if tool_args is None:
                                if hasattr(tool_call, "dict"):
                                    tool_dict = tool_call.dict()
                                    tool_args = tool_dict.get("args") or tool_dict.get("arguments") or {}
                                else:
                                    tool_args = {}

                        if not tool_name or not tool_call_id:
                            continue

                        if tool_name:
                            self.tool_call_names[tool_call_id] = tool_name

                        if isinstance(tool_args, str):
                            try:
                                tool_args = json.loads(tool_args)
                            except json.JSONDecodeError:
                                tool_args = {}
                        elif tool_args is None:
                            tool_args = {}

                        if tool_call_id not in self.tool_call_args:
                            self.tool_call_args[tool_call_id] = {}

                        if tool_args and isinstance(tool_args, dict):
                            self.tool_call_args[tool_call_id].update(tool_args)

                        final_args = self.tool_call_args[tool_call_id]

                        if final_args and tool_call_id not in self.sent_tool_call_ids:
                            self.sent_tool_call_ids.add(tool_call_id)
                            logger.info(f"工具调用: name={tool_name}, id={tool_call_id}")
                            event = {
                                "type": "tool_call",
                                "id": tool_call_id,
                                "name": tool_name,
                                "arguments": final_args,
                            }
                            yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"

                # 处理工具调用参数流
                if hasattr(message_chunk, "tool_call_chunks") and message_chunk.tool_call_chunks:
                    for tool_call_chunk in message_chunk.tool_call_chunks:
                        chunk_dict = tool_call_chunk
                        if not isinstance(chunk_dict, dict):
                            if hasattr(tool_call_chunk, "dict"):
                                chunk_dict = tool_call_chunk.dict()
                            else:
                                chunk_dict = {"args": str(tool_call_chunk)}

                        args_chunk = chunk_dict.get("args")
                        tc_id = chunk_dict.get("id")
                        tool_name_from_chunk = chunk_dict.get("name")

                        if not tc_id:
                            if self.tool_call_names:
                                tc_id = list(self.tool_call_names.keys())[-1]

                        if args_chunk and tc_id:
                            if tc_id not in self.tool_call_args_buffer:
                                self.tool_call_args_buffer[tc_id] = ""

                            if isinstance(args_chunk, str):
                                self.tool_call_args_buffer[tc_id] += args_chunk
                                try:
                                    parsed_args = json.loads(self.tool_call_args_buffer[tc_id])
                                    if isinstance(parsed_args, dict):
                                        if tc_id not in self.tool_call_args:
                                            self.tool_call_args[tc_id] = {}
                                        self.tool_call_args[tc_id].update(parsed_args)
                                        tool_name_from_storage = self.tool_call_names.get(tc_id)
                                        tool_name = tool_name_from_storage or tool_name_from_chunk
                                        if tool_name and tc_id not in self.sent_tool_call_ids:
                                            self.sent_tool_call_ids.add(tc_id)
                                            event = {
                                                "type": "tool_call",
                                                "id": tc_id,
                                                "name": tool_name,
                                                "arguments": self.tool_call_args[tc_id],
                                            }
                                            yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
                                except json.JSONDecodeError:
                                    pass
                            elif isinstance(args_chunk, dict):
                                if tc_id not in self.tool_call_args:
                                    self.tool_call_args[tc_id] = {}
                                self.tool_call_args[tc_id].update(args_chunk)
                                tool_name_from_storage = self.tool_call_names.get(tc_id)
                                tool_name = tool_name_from_storage or tool_name_from_chunk
                                if tool_name and tc_id not in self.sent_tool_call_ids:
                                    self.sent_tool_call_ids.add(tc_id)
                                    event = {
                                        "type": "tool_call",
                                        "id": tc_id,
                                        "name": tool_name,
                                        "arguments": self.tool_call_args[tc_id],
                                    }
                                    yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"

        except Exception as e:
            logger.error(f"处理消息chunk时出错: {str(e)}")
            import traceback

            logger.error(traceback.format_exc())
            error_event = {"type": "error", "error": f"处理消息chunk时出错: {str(e)}"}
            yield f"data: {json.dumps(error_event, ensure_ascii=False)}\n\n"
