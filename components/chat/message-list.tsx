"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2, Bot, User, Search, Image, CheckCircle2, XCircle, ChevronDown, ChevronRight } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import type { Components } from "react-markdown"
import type { Message, ToolCall } from "@/types"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

interface MessageListProps {
  messages: Message[]
}

export function MessageList({ messages }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  if (messages.length === 0) return null

  return (
    <div className="space-y-6">
      {messages.map((msg) => (
        <MessageItem key={msg.id} message={msg} />
      ))}
      <div ref={bottomRef} />
    </div>
  )
}

// Markdown 组件映射（AI 气泡专用样式）
const markdownComponents: Components = {
  p: ({ children }) => (
    <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
  ),
  h1: ({ children }) => (
    <h1 className="text-base font-bold mt-4 mb-2 first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-sm font-bold mt-3 mb-1.5 first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-semibold mt-2 mb-1 first:mt-0">{children}</h3>
  ),
  ul: ({ children }) => (
    <ul className="mb-2 ml-4 space-y-0.5 list-disc">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-2 ml-4 space-y-0.5 list-decimal">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="leading-relaxed">{children}</li>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic">{children}</em>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-current/30 pl-3 my-2 opacity-80 italic">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-current/20" />,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="underline underline-offset-2 opacity-80 hover:opacity-100"
    >
      {children}
    </a>
  ),
  code: ({ children, className }) => {
    const isBlock = className?.startsWith("language-")
    if (isBlock) return <code className={className}>{children}</code>
    return (
      <code className="bg-black/10 dark:bg-white/10 rounded px-1 py-0.5 text-[0.8em] font-mono">
        {children}
      </code>
    )
  },
  pre: ({ children }) => (
    <pre className="bg-black/10 dark:bg-white/10 rounded-lg p-3 my-2 overflow-x-auto text-xs font-mono leading-relaxed">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto my-2">
      <table className="w-full text-xs border-collapse">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-current/20 px-2 py-1 text-left font-semibold bg-black/5 dark:bg-white/5">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-current/20 px-2 py-1">{children}</td>
  ),
}

function MessageItem({ message }: { message: Message }) {
  const isUser = message.role === "user"

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <Avatar className="h-8 w-8 shrink-0 mt-0.5">
        <AvatarFallback className={cn(isUser ? "bg-primary text-primary-foreground" : "bg-muted")}>
          {isUser ? <User size={14} /> : <Bot size={14} />}
        </AvatarFallback>
      </Avatar>

      <div className={cn("flex-1 min-w-0 space-y-2", isUser && "flex flex-col items-end")}>
        {/* 工具调用内联卡片（仅 AI 消息，显示在文字上方） */}
        {!isUser && message.toolCalls && message.toolCalls.length > 0 && (
          <div className="w-full space-y-2">
            {message.toolCalls.map((tc) => (
              <InlineToolCall key={tc.id} toolCall={tc} />
            ))}
          </div>
        )}

        {/* 消息气泡 */}
        {(message.content || (!isUser && message.status === "streaming" && (!message.toolCalls || message.toolCalls.length === 0))) && (
          <div
            className={cn(
              "rounded-2xl px-4 py-3 text-sm",
              isUser
                ? "bg-primary text-primary-foreground rounded-tr-sm max-w-[80%]"
                : "bg-muted rounded-tl-sm"
            )}
          >
            {/* 空消息 + 流式中 + 无工具调用：显示加载 */}
            {!message.content && message.status === "streaming" && (
              <span className="flex items-center gap-2 text-muted-foreground">
                <Loader2 size={14} className="animate-spin" />
                思考中...
              </span>
            )}

            {/* 用户消息：纯文本（保留换行） */}
            {isUser && message.content && (
              <span className="whitespace-pre-wrap leading-relaxed">{message.content}</span>
            )}

            {/* AI 消息：Markdown 渲染 */}
            {!isUser && message.content && (
              <div className="prose-sm">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={markdownComponents}
                >
                  {message.content}
                </ReactMarkdown>
              </div>
            )}

            {/* 流式光标 */}
            {!isUser && message.status === "streaming" && message.content && (
              <span className="inline-block w-0.5 h-[1em] bg-current ml-0.5 align-middle animate-pulse" />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const TOOL_ICONS: Record<string, React.ReactNode> = {
  web_search: <Search size={13} />,
  generate_image: <Image size={13} />,
}

const TOOL_LABELS: Record<string, string> = {
  web_search: "网络搜索",
  generate_image: "生成图片",
}

function InlineToolCall({ toolCall }: { toolCall: ToolCall }) {
  const [expanded, setExpanded] = useState(true)

  const isDone = toolCall.status === "done"
  const isRunning = toolCall.status === "running" || toolCall.status === "pending"
  const isError = toolCall.status === "error"

  const elapsed =
    toolCall.startedAt && toolCall.endedAt
      ? ((toolCall.endedAt - toolCall.startedAt) / 1000).toFixed(1) + "s"
      : null

  return (
    <div className="border border-border rounded-xl overflow-hidden text-sm">
      {/* 头部 */}
      <button
        className="flex items-center gap-2 w-full px-3 py-2 bg-muted/40 hover:bg-muted/70 transition-colors text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? <ChevronDown size={13} className="shrink-0 text-muted-foreground" /> : <ChevronRight size={13} className="shrink-0 text-muted-foreground" />}
        <span className="text-muted-foreground shrink-0">{TOOL_ICONS[toolCall.name] ?? <Search size={13} />}</span>
        <span className="font-medium flex-1 text-xs">{TOOL_LABELS[toolCall.name] ?? toolCall.name}</span>
        {isRunning && <Loader2 size={13} className="animate-spin text-blue-500 shrink-0" />}
        {isDone && <CheckCircle2 size={13} className="text-green-500 shrink-0" />}
        {isError && <XCircle size={13} className="text-destructive shrink-0" />}
        {elapsed && <span className="text-xs text-muted-foreground">{elapsed}</span>}
      </button>

      {/* 展开内容 */}
      {expanded && (
        <div className="px-3 py-2.5 space-y-2.5 border-t border-border">
          {/* 搜索关键词 */}
          {toolCall.name === "web_search" && !!toolCall.input.query && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Search size={11} />
              <span className="font-mono">{String(toolCall.input.query)}</span>
            </div>
          )}

          {/* 结果 */}
          {toolCall.output !== undefined && (
            <ToolOutputInline toolName={toolCall.name} output={toolCall.output} />
          )}

          {/* 加载中占位 */}
          {isRunning && toolCall.output === undefined && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
              <Loader2 size={12} className="animate-spin" />
              正在获取结果...
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ToolOutputInline({ toolName, output }: { toolName: string; output: unknown }) {
  if (toolName === "generate_image" && typeof output === "object" && output !== null) {
    const { url, revisedPrompt, error } = output as { url?: string; revisedPrompt?: string; error?: string }
    if (error) {
      return <div className="text-xs text-destructive">{error}</div>
    }
    if (url) {
      return (
        <div className="space-y-1.5">
          <img src={url} alt="Generated" className="rounded-lg max-w-full border border-border" />
          {revisedPrompt && (
            <div className="text-xs text-muted-foreground">{revisedPrompt}</div>
          )}
        </div>
      )
    }
  }

  if (toolName === "web_search" && typeof output === "object" && output !== null) {
    const { abstract, abstractURL, relatedTopics, error } = output as {
      abstract?: string
      abstractURL?: string
      relatedTopics?: Array<{ text: string; url: string }>
      error?: string
    }

    if (error) {
      return <div className="text-xs text-destructive">{error}</div>
    }

    return (
      <div className="space-y-2 text-xs">
        {abstract && (
          <p className="text-foreground leading-relaxed">{abstract}</p>
        )}
        {abstractURL && (
          <a
            href={abstractURL}
            target="_blank"
            rel="noreferrer"
            className="text-blue-500 hover:underline break-all block"
          >
            {abstractURL}
          </a>
        )}
        {relatedTopics && relatedTopics.length > 0 && (
          <div className="space-y-1">
            <div className="font-medium text-muted-foreground">相关内容</div>
            <ul className="space-y-1">
              {relatedTopics.map((t, i) => (
                <li key={i} className="text-muted-foreground leading-relaxed">{t.text}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )
  }

  return (
    <pre className="text-xs bg-muted rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
      {typeof output === "string" ? output : JSON.stringify(output, null, 2)}
    </pre>
  )
}
