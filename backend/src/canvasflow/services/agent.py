"""Agent 服务 - 创建 LangGraph ReAct Agent 并处理流式输出"""
import json
import logging
from typing import List, Dict, Any, AsyncGenerator, Optional
from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent
from canvasflow.config import settings
from canvasflow.services.stream import StreamProcessor
from canvasflow.tools.generate import generate_image_tool
from canvasflow.tools.edit import edit_image_tool

logger = logging.getLogger(__name__)

# 系统提示词 - 精简版，仅保留图片创作
SYSTEM_PROMPT = """你是 CanvasFlow，一个专注于 AI 图片创作的智能助手。你能够理解用户的创作意图，自主生成和编辑图片，所有结果会自动呈现在无限画布上。

<核心执行哲学>
自主拆解：面对复杂需求，将其拆解为合理的执行步骤，逐步执行。
智能编排：简单任务精准执行；复杂任务按顺序调用工具，每步输出作为下一步的输入。
</核心执行哲学>

<工作方式>
你是一个自主的智能体 - 持续工作直到用户请求完全解决。

**重要：避免重复调用工具**
- 简单单次请求（如"生成一张图片"），调用一次工具后结束回复
- 只有用户明确要求多次生成时，才多次调用工具
- 工具调用成功后，用自然语言描述结果并结束

当用户提出创作需求时：
1. **深度解析**：分析核心目标、风格偏好
2. **说明意图**：调用工具前简洁告知用户你的计划
3. **自主执行**：调用工具完成任务
4. **最终交付**：用自然语言描述成果，隐藏技术细节
</工作方式>

<工具调用规则>
你拥有以下工具：
{tools_list_text}

**关键规则：**
1. **调用工具前先说明意图**
2. **按需调用**：简单请求不冗余调用；复杂请求果断多步操作
3. **不要重复调用相同工具**
4. **上下文感知**：自动提取最近生成的图像 URL 作为后续工具输入
5. **如果工具调用失败**：检查错误信息，重试或向用户说明
</工具调用规则>

<沟通规范>
1. **使用自然语言**：友好、专业地与用户交流
2. **隐藏技术细节**：不向用户展示 URL、路径等
3. **描述创作内容**：生成后简洁描述主要内容和特点
4. **主动确认理解**：需求不明确时询问细节
5. **提供建议**：可以友好地提供优化建议
</沟通规范>

<上下文理解>
1. **充分利用对话历史**：理解完整需求和上下文
2. **识别内容引用**：当用户说"编辑这张图片"时，从历史中找到最近生成的图片
3. **理解用户意图**：区分生成新图片还是编辑现有图片
</上下文理解>

<Prompt优化建议>
主动帮助优化提示词：
- 画质：高清、4K、细节丰富、专业摄影
- 风格：写实、卡通、水彩、油画、赛博朋克
- 光照：自然光、柔和光、电影光效、黄金时刻
- 构图：特写、全景、俯视、仰视
</Prompt优化建议>

现在开始工作，根据用户的需求进行图片创作。
"""


def create_llm():
    """创建 LLM 实例（DashScope 兼容端点）"""
    return ChatOpenAI(
        base_url=settings.dashscope_base_url,
        api_key=settings.dashscope_api_key,
        model=settings.dashscope_model,
        temperature=0.7,
        streaming=True,
        max_tokens=2048,
    )


def create_agent():
    """创建 LangGraph Agent"""
    model = create_llm()

    tools = [
        generate_image_tool,
        edit_image_tool,
    ]
    logger.info(f"注册工具: {[tool.name for tool in tools]}")

    # 动态生成工具列表描述
    tool_descriptions = []
    for tool in tools:
        tool_descriptions.append(f"- {tool.name}: {tool.description}")
    tools_list_text = "\n".join(tool_descriptions)

    full_prompt = SYSTEM_PROMPT.format(tools_list_text=tools_list_text)

    agent = create_react_agent(
        name="canvasflow_image_agent",
        model=model,
        tools=tools,
        prompt=full_prompt
    )

    logger.info("Agent 创建成功")
    return agent


async def process_chat_stream(
    messages: List[Dict[str, Any]],
    session_id: Optional[str] = None
) -> AsyncGenerator[str, None]:
    """处理聊天流式响应"""
    try:
        logger.info(f"收到聊天请求: session_id={session_id}, messages_count={len(messages)}")

        agent = create_agent()
        processor = StreamProcessor(session_id)

        async for event in processor.process_stream(agent, messages):
            try:
                yield event
            except (GeneratorExit, StopAsyncIteration, ConnectionError, BrokenPipeError, OSError) as e:
                logger.info(f"客户端断开连接: {type(e).__name__}: {str(e)}")
                raise
            except Exception as e:
                logger.warning(f"发送事件时出错: {type(e).__name__}: {str(e)}")
                raise

    except (GeneratorExit, StopAsyncIteration, ConnectionError, BrokenPipeError, OSError) as e:
        logger.info(f"客户端断开连接: {type(e).__name__}")
        return
    except Exception as e:
        import traceback
        logger.error(f"处理聊天流时出错: {str(e)}")
        logger.error(traceback.format_exc())
        try:
            error_event = {"type": "error", "error": str(e)}
            yield f"data: {json.dumps(error_event, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"
        except:
            pass
