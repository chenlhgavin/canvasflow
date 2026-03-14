import { useState, useRef, useEffect, useMemo } from 'react'
import { Send, Paperclip, Image as ImageIcon, Sparkles, X, ChevronDown, ChevronRight, Link as LinkIcon, ArrowLeft, Sun, Moon, Pause, Play } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import './ChatInterface.css'
import ExcalidrawCanvas, {
  ExcalidrawCanvasData,
  ExcalidrawCanvasHandle,
} from './ExcalidrawCanvas'
import { apiFetch } from '../utils/api'

type ChatInterfaceProps = {
  initialCanvasId?: string
  theme: 'dark' | 'light'
  onToggleTheme: () => void
  onSetTheme: (t: 'dark' | 'light') => void
}

interface ToolCall {
  id: string
  name: string
  arguments: any
  status: 'executing' | 'done'
  result?: any
  imageUrl?: string
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  postToolContent?: string
  toolCalls?: ToolCall[]
  imageUrls?: string[] // 用户消息中的图片URL列表
}

interface CanvasImage {
  id: string
  url: string
  x: number
  y: number
  width: number
  height: number
}

interface Canvas {
  id: string
  name: string
  createdAt: number
  // Legacy: old DOM-drag canvas images
  images?: CanvasImage[]
  // New: Excalidraw canvas data
  data?: ExcalidrawCanvasData
  messages: Message[]
}

const ChatInterface = ({ initialCanvasId, theme, onToggleTheme, onSetTheme }: ChatInterfaceProps) => {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [uploadedImages, setUploadedImages] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatMessagesRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null)
  const isPausedRef = useRef<boolean>(false)

  // 工具展开状态
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set())

  // 画布管理状态
  const [canvases, setCanvases] = useState<Canvas[]>([])
  const [currentCanvasId, setCurrentCanvasId] = useState<string>('')

  const excalidrawRef = useRef<ExcalidrawCanvasHandle | null>(null)
  const [chatPanelCollapsed, setChatPanelCollapsed] = useState(false)
  const pendingSendRef = useRef<string | null>(null)

  // 清理参数中的base64数据
  const sanitizeArguments = (args: any): any => {
    if (!args || typeof args !== 'object') return args
    const sanitized = { ...args }
    for (const key in sanitized) {
      const value = sanitized[key]
      if (typeof value === 'string') {
        if (value.startsWith('data:image/') && value.includes('base64,')) {
          sanitized[key] = '[Base64数据已隐藏]'
        } else if (value.length > 1000 && /^[A-Za-z0-9+/=]+$/.test(value)) {
          sanitized[key] = '[Base64数据已隐藏]'
        }
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = sanitizeArguments(value)
      }
    }
    return sanitized
  }

  const emptyCanvasData: ExcalidrawCanvasData = useMemo(
    () => ({ elements: [], appState: {}, files: {} }),
    []
  )

  const sanitizeCanvasData = (data: ExcalidrawCanvasData): ExcalidrawCanvasData => {
    const appState: any = data?.appState && typeof data.appState === 'object' ? { ...data.appState } : {}
    if ('collaborators' in appState) {
      appState.collaborators = undefined
    }
    return {
      elements: Array.isArray(data?.elements) ? data.elements : [],
      files: (data?.files && typeof data.files === 'object') ? (data.files as any) : {},
      appState,
    }
  }

  const migrateLegacyCanvasToExcalidraw = (canvas: Canvas): Canvas => {
    if (canvas.data) {
      return { ...canvas, data: sanitizeCanvasData(canvas.data) }
    }
    const legacyImages = canvas.images || []
    if (legacyImages.length === 0) {
      return { ...canvas, data: emptyCanvasData }
    }

    const files: Record<string, any> = {}
    const elements: any[] = []

    for (const img of legacyImages) {
      const fileId = img.id || `im_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`
      files[fileId] = {
        id: fileId,
        dataURL: img.url,
        mimeType: 'image/png',
        created: Date.now(),
      }
      elements.push({
        type: 'image',
        id: fileId,
        x: img.x || 0,
        y: img.y || 0,
        width: img.width || 300,
        height: img.height || 300,
        angle: 0,
        fileId,
        strokeColor: '#000000',
        fillStyle: 'solid',
        strokeStyle: 'solid',
        boundElements: null,
        roundness: null,
        frameId: null,
        backgroundColor: 'transparent',
        strokeWidth: 1,
        roughness: 0,
        opacity: 100,
        groupIds: [],
        seed: Math.floor(Math.random() * 1_000_000),
        version: 1,
        versionNonce: Math.floor(Math.random() * 1_000_000),
        isDeleted: false,
        index: null,
        updated: Date.now(),
        link: null,
        locked: false,
        status: 'saved',
        scale: [1, 1],
        crop: null,
      })
    }

    return {
      ...canvas,
      data: sanitizeCanvasData({ elements, appState: {}, files }),
    }
  }

  // 初始化：加载画布列表
  useEffect(() => {
    fetchCanvases()
  }, [])

  const getCanvasLink = (canvasId: string) => {
    const url = new URL(window.location.href)
    url.searchParams.set('canvasId', canvasId)
    return url.toString()
  }

  const setCanvasIdInUrl = (canvasId: string) => {
    const url = new URL(window.location.href)
    url.searchParams.set('canvasId', canvasId)
    window.history.replaceState({}, '', url.toString())
  }

  const goHome = () => {
    const url = new URL(window.location.href)
    url.searchParams.delete('canvasId')
    window.history.pushState({}, '', url.toString())
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  const getCanvasIdFromUrl = () => {
    try {
      const url = new URL(window.location.href)
      return url.searchParams.get('canvasId') || ''
    } catch {
      return ''
    }
  }

  const fetchCanvases = async () => {
    try {
      const res = await fetch('/api/canvases')
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data) && data.length > 0) {
          const migrated = data.map(migrateLegacyCanvasToExcalidraw)
          setCanvases(migrated)
          const urlId = getCanvasIdFromUrl()
          const lastId = localStorage.getItem('canvasflow_current_canvas_id')
          const preferredId = initialCanvasId || urlId || lastId || ''
          const target = migrated.find((c: Canvas) => c.id === preferredId) || migrated[0]
          const canvasId = target.id
          setCurrentCanvasId(canvasId)
          setCanvasIdInUrl(canvasId)

          const pendingKey = `pending_prompt:${canvasId}`
          const hasPending = sessionStorage.getItem(pendingKey)

          if (hasPending) {
            setMessages([])
          } else {
            setMessages(target.messages || [])
          }
        } else {
          createNewCanvas()
        }
      } else {
        createNewCanvas()
      }
    } catch (e) {
      console.error('获取画布失败', e)
      createNewCanvas()
    }
  }

  const saveCanvasToBackend = async (canvas: Canvas) => {
    try {
      await apiFetch('/api/canvases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(canvas)
      })
    } catch (e) {
      console.error('保存画布失败', e)
    }
  }

  // 当 messages 变化时，防抖保存到后端
  useEffect(() => {
    if (!currentCanvasId) return

    const timer = setTimeout(() => {
      setCanvases(prev => {
        const next = prev.map(canvas => {
          if (canvas.id === currentCanvasId) {
            if (JSON.stringify(canvas.messages) !== JSON.stringify(messages)) {
              const updatedCanvas = { ...canvas, messages }
              saveCanvasToBackend(updatedCanvas)
              return updatedCanvas
            }
          }
          return canvas
        })
        return next
      })
    }, 5000)

    return () => clearTimeout(timer)
  }, [messages, currentCanvasId])

  useEffect(() => {
    if (currentCanvasId) {
      localStorage.setItem('canvasflow_current_canvas_id', currentCanvasId)
    }
  }, [currentCanvasId])

  const createNewCanvas = async () => {
    const newCanvas: Canvas = {
      id: `canvas-${Date.now()}`,
      name: `项目 ${canvases.length + 1}`,
      createdAt: Date.now(),
      images: [],
      data: emptyCanvasData,
      messages: []
    }

    await saveCanvasToBackend(newCanvas)

    setCanvases(prev => [newCanvas, ...prev])
    setCurrentCanvasId(newCanvas.id)
    setCanvasIdInUrl(newCanvas.id)
    setMessages([])
  }

  const copyCurrentCanvasLink = async () => {
    if (!currentCanvasId) return
    const link = getCanvasLink(currentCanvasId)
    try {
      await navigator.clipboard.writeText(link)
    } catch (e) {
      window.prompt('复制这个链接：', link)
    }
  }

  const toggleToolDetails = (toolId: string) => {
    setExpandedTools(prev => {
      const next = new Set(prev)
      if (next.has(toolId)) {
        next.delete(toolId)
      } else {
        next.add(toolId)
      }
      return next
    })
  }

  const getCurrentCanvas = () => canvases.find((c) => c.id === currentCanvasId)

  const updateCurrentCanvasData = (updater: (prev: ExcalidrawCanvasData) => ExcalidrawCanvasData) => {
    setCanvases(prev => {
      const nextCanvases = prev.map(canvas => {
        if (canvas.id === currentCanvasId) {
          const base = migrateLegacyCanvasToExcalidraw(canvas)
          const newData = updater(base.data || emptyCanvasData)
          const updatedCanvas: Canvas = { ...base, data: newData }
          saveCanvasToBackend(updatedCanvas)
          return updatedCanvas
        }
        return canvas
      })
      return nextCanvases
    })
  }

  const scrollToBottom = (behavior: ScrollBehavior = 'auto') => {
    const el = chatMessagesRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior })
  }

  useEffect(() => {
    scrollToBottom('auto')
  }, [messages])

  const sendMessage = async (userMessage: string, skipAddUserMessage = false, userMessageObj?: Message) => {
    const trimmed = (userMessage || '').trim()
    if (!trimmed || isLoading) return
    setIsLoading(true)

    let newUserMessage: Message
    if (userMessageObj) {
      newUserMessage = userMessageObj
    } else if (skipAddUserMessage) {
      const lastMessage = messages[messages.length - 1]
      if (lastMessage && lastMessage.role === 'user' && (lastMessage.content || '').trim() === trimmed) {
        newUserMessage = lastMessage
      } else {
        newUserMessage = { role: 'user', content: trimmed }
      }
    } else {
      newUserMessage = { role: 'user', content: trimmed }
      setMessages((prev) => [...prev, newUserMessage])
    }

    try {
      const messagesToUse = (() => {
        if (userMessageObj) {
          const last = messages[messages.length - 1]
          if (last && last.role === 'user' && (last.content || '').trim() === trimmed) {
            return messages
          }
          return [...messages, userMessageObj]
        }
        if (!skipAddUserMessage) return [...messages, newUserMessage]
        const last = messages[messages.length - 1]
        if (last && last.role === 'user' && (last.content || '').trim() === trimmed) return messages
        return [...messages, newUserMessage]
      })()
      const messageHistory = messagesToUse.map((msg) => {
        let content = msg.content || ''
        if (msg.postToolContent) {
          content += '\n' + msg.postToolContent
        }
        if (msg.toolCalls) {
          const imageUrls = msg.toolCalls
            .map((tc) => tc.imageUrl)
            .filter(Boolean) as string[]
          if (imageUrls.length) {
            content += `\n\nGenerated Image:\n${imageUrls.map((u) => `- ${u}`).join('\n')}`
          }
        }
        return { role: msg.role, content }
      })

      const abortController = new AbortController()
      abortControllerRef.current = abortController

      const response = await apiFetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({
          message: trimmed,
          messages: messageHistory.slice(0, -1),
        }),
        signal: abortController.signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const reader = response.body?.getReader()
      readerRef.current = reader ?? null
      const decoder = new TextDecoder()

      if (!reader) throw new Error('无法读取响应流')

      let buffer = ''

      const appendDelta = (deltaText: string) => {
        setMessages((prev) => {
          const next = [...prev]
          const last = next[next.length - 1]
          if (last && last.role === 'assistant' && (!last.toolCalls || last.toolCalls.length === 0)) {
            next[next.length - 1] = { ...last, content: (last.content || '') + deltaText }
            return next
          }
          next.push({ role: 'assistant', content: deltaText })
          return next
        })
      }

      const appendToolStep = (toolCall: ToolCall) => {
        setMessages((prev) => {
          // 防止重复 tool_call id 创建多个消息气泡
          if (prev.some(m => m.toolCalls?.some(tc => tc.id === toolCall.id))) {
            return prev
          }
          return [
            ...prev,
            {
              role: 'assistant',
              content: '',
              toolCalls: [toolCall],
            },
          ]
        })
      }

      const updateToolStep = (toolCallId: string, updater: (tc: ToolCall) => ToolCall) => {
        setMessages((prev) => {
          const next = prev.map((m) => {
            if (!m.toolCalls) return m
            if (!m.toolCalls.some((tc) => tc.id === toolCallId)) return m
            return {
              ...m,
              toolCalls: m.toolCalls.map((tc) => (tc.id === toolCallId ? updater(tc) : tc)),
            }
          })
          return next
        })
      }

      while (true) {
        if (isPausedRef.current) {
          try {
            await reader.cancel()
          } catch (e) {
            // ignore
          }
          readerRef.current = null
          break
        }

        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        buffer += chunk
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.trim() === '') continue

          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim()
            if (data === '[DONE]') continue

            try {
              const event = JSON.parse(data)

              switch (event.type) {
                case 'delta':
                  if (event.content) {
                    appendDelta(event.content)
                    setTimeout(() => scrollToBottom('auto'), 0)
                  }
                  break

                case 'tool_call':
                  appendToolStep({
                    id: event.id,
                    name: event.name,
                    arguments: sanitizeArguments(event.arguments),
                    status: 'executing',
                  })
                  break

                case 'tool_call_chunk':
                  break

                case 'tool_result':
                  updateToolStep(event.tool_call_id, (tc) => {
                    let updatedArgs = tc.arguments
                    let imageUrl: string | undefined = tc.imageUrl
                    try {
                      const resultObj = JSON.parse(event.content)
                      if (resultObj && resultObj.prompt && (!updatedArgs || Object.keys(updatedArgs).length === 0)) {
                        updatedArgs = { prompt: resultObj.prompt }
                      }
                      if (resultObj && typeof resultObj.image_url === 'string') {
                        imageUrl = resultObj.image_url
                      }
                    } catch (e) {
                      // ignore
                    }
                    let sanitizedResult = event.content
                    try {
                      const resultObj = JSON.parse(event.content)
                      const sanitizedObj = sanitizeArguments(resultObj)
                      sanitizedResult = JSON.stringify(sanitizedObj)
                    } catch (e) {
                      if (typeof event.content === 'string' &&
                          (event.content.startsWith('data:image/') ||
                           (event.content.length > 1000 && /^[A-Za-z0-9+/=]+$/.test(event.content)))) {
                        sanitizedResult = '[Base64数据已隐藏]'
                      }
                    }

                    return {
                      ...tc,
                      status: 'done' as const,
                      result: sanitizedResult,
                      arguments: sanitizeArguments(updatedArgs),
                      imageUrl,
                    }
                  })

                  if (event.content) {
                    try {
                      const result = JSON.parse(event.content)
                      if (typeof result.image_url === 'string' && result.image_url) {
                        const imgUrl: string = result.image_url
                        await excalidrawRef.current?.addImage({ url: imgUrl })
                        scrollToBottom('auto')
                      }
                    } catch (e) {
                      console.error('解析结果失败', e)
                    }
                  }
                  break

                case 'error':
                  setMessages((prev) => {
                    const newMessages = [...prev]
                    const lastMessage = newMessages[newMessages.length - 1]
                    if (lastMessage && lastMessage.role === 'assistant') {
                      lastMessage.content = `错误: ${event.error}`
                    }
                    return newMessages
                  })
                  break
              }
            } catch (e) {
              console.error('解析事件失败:', e)
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('请求已暂停')
        return
      }
      console.error('请求失败:', error)
      setMessages((prev) => {
        const newMessages = [...prev]
        const lastMessage = newMessages[newMessages.length - 1]
        if (lastMessage && lastMessage.role === 'assistant') {
          lastMessage.content = `错误: ${error instanceof Error ? error.message : '未知错误'}`
        }
        return newMessages
      })
    } finally {
      if (!isPausedRef.current) {
        setIsLoading(false)
        abortControllerRef.current = null
        readerRef.current = null
      }
      scrollToBottom('smooth')
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      alert('只支持图片文件')
      return
    }

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await apiFetch('/api/upload-image', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('上传失败')
      }

      const data = await response.json()
      setUploadedImages(prev => [...prev, data.url])
    } catch (error) {
      console.error('文件上传失败:', error)
      alert('文件上传失败，请重试')
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const removeUploadedImage = (index: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index))
  }

  // 处理粘贴图片
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    try {
      const items = e.clipboardData?.items
      if (!items) return

      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.type.indexOf('image') !== -1) {
          e.preventDefault()
          const file = item.getAsFile()
          if (!file) continue

          ;(async () => {
            try {
              const formData = new FormData()
              formData.append('file', file)

              const response = await apiFetch('/api/upload-image', {
                method: 'POST',
                body: formData,
              })

              if (!response.ok) {
                throw new Error('上传失败')
              }

              const data = await response.json()
              setUploadedImages(prev => [...prev, data.url])
            } catch (error) {
              console.error('图片粘贴上传失败:', error)
              alert('图片粘贴上传失败，请重试')
            }
          })()
          break
        }
      }
    } catch (error) {
      console.error('粘贴处理错误:', error)
    }
  }

  // 暂停对话
  const handlePause = () => {
    if (isLoading && !isPaused) {
      setIsPaused(true)
      isPausedRef.current = true
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      if (readerRef.current) {
        readerRef.current.cancel()
        readerRef.current = null
      }
      setIsLoading(false)
    }
  }

  // 恢复对话
  const handleResume = async () => {
    if (isPaused) {
      setIsPaused(false)
      isPausedRef.current = false
      const lastUserMessage = messages.filter(m => m.role === 'user').pop()
      if (lastUserMessage) {
        setMessages((prev) => {
          const filtered = prev.filter((m, index) => {
            if (index === prev.length - 1 && m.role === 'assistant' && (!m.content || m.content.trim().length < 10)) {
              return false
            }
            return true
          })
          return filtered
        })
        await sendMessage(lastUserMessage.content, true)
      }
    }
  }

  const handleSend = async () => {
    if ((!input.trim() && uploadedImages.length === 0) || isLoading) return

    if (isPaused) {
      setIsPaused(false)
      isPausedRef.current = false
    }

    let messageContent = input.trim()
    const imageUrls = [...uploadedImages]

    if (uploadedImages.length > 0) {
      const imageTexts = uploadedImages.map(url => `[图片: ${url}]`).join('\n')
      if (messageContent) {
        messageContent = `${messageContent}\n\n${imageTexts}`
      } else {
        messageContent = imageTexts
      }
    }

    const userMessageObj: Message = {
      role: 'user',
      content: messageContent,
      imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
    }

    setMessages(prev => [...prev, userMessageObj])
    setInput('')
    setUploadedImages([])

    await sendMessage(messageContent, true, userMessageObj)
  }

  // 首页创建项目后的 pending prompt 处理
  useEffect(() => {
    if (!currentCanvasId) return

    const key = `pending_prompt:${currentCanvasId}`
    const imagesKey = `pending_images:${currentCanvasId}`
    const pending = sessionStorage.getItem(key)
    const pendingImages = sessionStorage.getItem(imagesKey)

    if (!pending || !pending.trim()) return

    let imageUrls: string[] = []
    if (pendingImages) {
      try {
        imageUrls = JSON.parse(pendingImages) as string[]
      } catch (e) {
        console.error('解析图片列表失败', e)
      }
    }

    const userMessage: Message = {
      role: 'user',
      content: pending.trim(),
      imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
    }

    sessionStorage.removeItem(key)
    sessionStorage.removeItem(imagesKey)

    pendingSendRef.current = pending.trim()
    setMessages([userMessage])
  }, [currentCanvasId])

  // 监听消息变化，当消息设置完成后自动发送
  useEffect(() => {
    if (!pendingSendRef.current) return
    if (messages.length === 0) return
    if (isLoading) return

    const firstMessage = messages[0]
    const messageContent = firstMessage.content || ''
    const pendingContent = pendingSendRef.current

    if (firstMessage.role === 'user' &&
        (messageContent === pendingContent || messageContent.includes(pendingContent))) {
      const messageToSend = pendingSendRef.current
      pendingSendRef.current = null

      setTimeout(() => {
        const userMessageObj: Message = {
          role: 'user',
          content: firstMessage.content || messageToSend,
          imageUrls: firstMessage.imageUrls,
        }

        setMessages(prev => {
          const hasMessage = prev.some(m =>
            m.role === 'user' &&
            (m.content === messageToSend || m.content?.includes(messageToSend))
          )
          if (!hasMessage) {
            return [...prev, userMessageObj]
          } else {
            return prev.map(m => {
              if (m.role === 'user' && (m.content === messageToSend || m.content?.includes(messageToSend))) {
                return userMessageObj
              }
              return m
            })
          }
        })

        setTimeout(() => {
          sendMessage(firstMessage.content || messageToSend, true, userMessageObj)
        }, 50)
      }, 150)
    }
  }, [messages, isLoading])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const cleanMessageContent = (content: string) => {
    if (!content) return ''
    return content
  }

  // 获取工具显示名称
  const getToolDisplayName = (name: string) => {
    const map: Record<string, string> = {
      'generate_image': '生成图像',
      'edit_image': '编辑图像',
    }
    return map[name] || name
  }

  // 获取当前画布数据
  const currentCanvas = getCurrentCanvas()
  const currentCanvasData =
    (currentCanvas ? migrateLegacyCanvasToExcalidraw(currentCanvas).data : emptyCanvasData) ||
    emptyCanvasData
  const hasAnyImages =
    (currentCanvasData?.elements || []).some((e: any) => e && !e.isDeleted && e.type === 'image')

  return (
    <div className="chat-interface">
      <div className="interface-layout">
        <div className="canvas-panel">
          {/* 画布控制栏 */}
          <div className="canvas-controls">
            <button className="control-btn" onClick={goHome} title="回到首页">
              <ArrowLeft size={18} />
              <span>首页</span>
            </button>
            <button className="control-btn" onClick={onToggleTheme} title="切换主题">
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              <span>{theme === 'dark' ? '亮色' : '暗色'}</span>
            </button>

            <button
              className="control-btn"
              onClick={copyCurrentCanvasLink}
              title="复制项目链接"
              disabled={!currentCanvasId}
            >
              <LinkIcon size={18} />
              <span>复制链接</span>
            </button>
          </div>

          <div className="canvas-content excalidraw-host-container">
            {!hasAnyImages ? (
              <div className="canvas-empty">
                <ImageIcon size={64} strokeWidth={1.5} className="empty-icon" />
                <p className="empty-title">AI 画板</p>
                <p className="canvas-hint">生成的图片将自动落到画布上（支持缩放、框选、对齐）</p>
              </div>
            ) : (
              <div />
            )}

            {currentCanvasId && (
              <ExcalidrawCanvas
                key={currentCanvasId}
                ref={excalidrawRef}
                canvasId={currentCanvasId}
                theme={theme}
                initialData={currentCanvasData}
                onDataChange={(data) => {
                  updateCurrentCanvasData(() => data)
                }}
                onThemeChange={(nextTheme) => {
                  if (nextTheme === 'dark' || nextTheme === 'light') {
                    onSetTheme(nextTheme)
                  }
                }}
                onImageToInput={async (url) => {
                  try {
                    if (url.startsWith('data:')) {
                      const response = await fetch(url)
                      const blob = await response.blob()
                      const formData = new FormData()
                      formData.append('file', blob, 'image.png')

                      const uploadResponse = await apiFetch('/api/upload-image', {
                        method: 'POST',
                        body: formData,
                      })

                      if (!uploadResponse.ok) {
                        throw new Error('上传失败')
                      }

                      const data = await uploadResponse.json()
                      setUploadedImages(prev => [...prev, data.url])
                    } else if (url.startsWith('/storage/')) {
                      setUploadedImages(prev => [...prev, url])
                    } else {
                      if (url.startsWith('http://') || url.startsWith('https://')) {
                        try {
                          const response = await fetch(url)
                          const blob = await response.blob()
                          const formData = new FormData()
                          formData.append('file', blob, 'image.png')

                          const uploadResponse = await apiFetch('/api/upload-image', {
                            method: 'POST',
                            body: formData,
                          })

                          if (uploadResponse.ok) {
                            const data = await uploadResponse.json()
                            setUploadedImages(prev => [...prev, data.url])
                          } else {
                            setUploadedImages(prev => [...prev, url])
                          }
                        } catch (e) {
                          console.error('处理图片 URL 失败:', e)
                          setUploadedImages(prev => [...prev, url])
                        }
                      } else {
                        setUploadedImages(prev => [...prev, url])
                      }
                    }
                  } catch (err) {
                    console.error('处理图片失败:', err)
                    alert('添加图片到输入框失败，请重试')
                  }
                }}
              />
            )}
          </div>

          {chatPanelCollapsed && (
            <button
              className="floating-chat-btn"
              onClick={() => setChatPanelCollapsed(false)}
              title="展开对话"
            >
              <Sparkles size={24} />
            </button>
          )}
        </div>

        <div className={`chat-panel ${chatPanelCollapsed ? 'collapsed' : ''}`}>
          <div className="chat-header">
            <div className="header-title">
              <h1>CanvasFlow</h1>
              <p>使用AI生成图像</p>
            </div>
            <button
              className="close-chat-btn"
              onClick={() => setChatPanelCollapsed(true)}
              title="收起对话"
            >
              <X size={20} />
            </button>
          </div>

          <div className="chat-messages" ref={chatMessagesRef}>
            {messages.length === 0 && (
              <div className="empty-state">
                <div className="empty-icon-wrapper">
                  <Sparkles size={32} className="empty-icon-inner" />
                </div>
                <h3>开始创作</h3>
                <p>描述你想象中的画面，AI 帮你实现</p>
              </div>
            )}

            {messages.map((message, index) => (
              <div
                key={index}
                className={`message ${message.role === 'user' ? 'user-message' : 'assistant-message'}`}
              >
                <div className="message-content">
                  {message.role === 'assistant' ? (
                    <>
                      {message.content && (
                        <div className="message-text">
                          <ReactMarkdown>{cleanMessageContent(message.content)}</ReactMarkdown>
                        </div>
                      )}

                      {message.toolCalls && message.toolCalls.length > 0 && (
                        <div className="tool-calls-container">
                          {message.toolCalls.map((toolCall) => (
                            <div key={toolCall.id} className="tool-call-wrapper">
                              <div
                                className={`tool-call-header ${toolCall.status === 'executing' ? 'executing' : 'done'}`}
                                onClick={() => toggleToolDetails(toolCall.id)}
                              >
                                <div className="tool-status-indicator">
                                  {toolCall.status === 'executing' ? (
                                    <div className="pulsing-dot" />
                                  ) : (
                                    <div className="status-dot done" />
                                  )}
                                </div>
                                <span className="tool-name">
                                  {getToolDisplayName(toolCall.name)}
                                </span>
                                <span className="tool-toggle-icon">
                                  {expandedTools.has(toolCall.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                </span>
                              </div>

                              {expandedTools.has(toolCall.id) && (
                                <div className="tool-details">
                                  <div className="tool-section">
                                    <span className="section-label">输入参数</span>
                                    <pre>{JSON.stringify(toolCall.arguments, null, 2)}</pre>
                                  </div>
                                  {toolCall.result && (
                                    <div className="tool-section">
                                      <span className="section-label">执行结果</span>
                                      <pre>{
                                        typeof toolCall.result === 'string'
                                          ? toolCall.result
                                          : JSON.stringify(toolCall.result, null, 2)
                                      }</pre>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {message.toolCalls?.some(tc => tc.imageUrl) && (
                        <div className="message-images">
                          {message.toolCalls
                            .filter(tc => tc.imageUrl)
                            .map(tc => (
                              <div key={`img-${tc.id}`} className="message-image">
                                <img src={tc.imageUrl} alt="Generated" />
                              </div>
                            ))}
                        </div>
                      )}

                      {message.postToolContent && (
                        <div className="message-text">
                          <ReactMarkdown>{cleanMessageContent(message.postToolContent)}</ReactMarkdown>
                        </div>
                      )}

                      {isLoading && index === messages.length - 1 && (
                        <span className="typing-cursor"></span>
                      )}
                    </>
                  ) : (
                    <>
                      {message.imageUrls && message.imageUrls.length > 0 && (
                        <div className="message-images">
                          {message.imageUrls.map((url, imgIndex) => (
                            <div key={`user-img-${imgIndex}`} className="message-image">
                              <img src={url} alt={`用户上传的图片 ${imgIndex + 1}`} />
                            </div>
                          ))}
                        </div>
                      )}
                      {(() => {
                        const textContent = message.content
                          .split('\n')
                          .filter(line => !line.trim().startsWith('[图片:'))
                          .join('\n')
                          .trim()
                        return textContent ? (
                          <div className="message-text">{textContent}</div>
                        ) : (message.imageUrls && message.imageUrls.length > 0) ? (
                          <div className="message-text" style={{ fontStyle: 'italic', color: '#9ca3af' }}>
                            （已发送图片）
                          </div>
                        ) : null
                      })()}
                    </>
                  )}
                </div>
              </div>
            ))}

            <div ref={messagesEndRef} />
          </div>

          <div className="chat-input-container">
            {uploadedImages.length > 0 && (
              <div className="uploaded-images-preview">
                {uploadedImages.map((url, index) => (
                  <div key={index} className="uploaded-image-item">
                    <img src={url} alt={`上传的图片 ${index + 1}`} />
                    <button
                      className="remove-image-btn"
                      onClick={() => removeUploadedImage(index)}
                      title="移除图片"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="input-row">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
              <button
                className="upload-image-button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                title="上传图片"
              >
                <Paperclip size={18} />
              </button>
              <textarea
                className="chat-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder="输入提示词生成图像..."
                rows={1}
                disabled={isLoading}
              />
              {isLoading && !isPaused ? (
                <button
                  className="pause-button"
                  onClick={handlePause}
                  title="暂停对话"
                >
                  <Pause size={18} />
                </button>
              ) : isPaused ? (
                <button
                  className="resume-button"
                  onClick={handleResume}
                  title="恢复对话"
                >
                  <Play size={18} />
                </button>
              ) : (
                <button
                  className="send-button"
                  onClick={handleSend}
                  disabled={isLoading || (!input.trim() && uploadedImages.length === 0)}
                >
                  <Send size={18} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ChatInterface
