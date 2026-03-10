"use client"

import { Search, Image, CheckCircle2, Loader2, XCircle, ChevronDown, ChevronRight } from "lucide-react"
import { useState } from "react"
import type { ToolCall } from "@/types"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

interface ToolPanelProps {
  toolCalls: ToolCall[]
}

const TOOL_ICONS: Record<string, React.ReactNode> = {
  web_search: <Search size={14} />,
  generate_image: <Image size={14} />,
}

const TOOL_LABELS: Record<string, string> = {
  web_search: "网络搜索",
  generate_image: "生成图片",
}

export function ToolPanel({ toolCalls }: ToolPanelProps) {
  if (toolCalls.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
          <Search size={20} />
        </div>
        <div className="text-sm">工具调用结果将在此显示</div>
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-3">
        {toolCalls.map((tc) => (
          <ToolCard key={tc.id} toolCall={tc} />
        ))}
      </div>
    </ScrollArea>
  )
}

function ToolCard({ toolCall }: { toolCall: ToolCall }) {
  const [expanded, setExpanded] = useState(true)

  const statusIcon = {
    pending: <Loader2 size={14} className="animate-spin text-muted-foreground" />,
    running: <Loader2 size={14} className="animate-spin text-blue-500" />,
    done: <CheckCircle2 size={14} className="text-green-500" />,
    error: <XCircle size={14} className="text-destructive" />,
  }[toolCall.status]

  const elapsed =
    toolCall.startedAt && toolCall.endedAt
      ? ((toolCall.endedAt - toolCall.startedAt) / 1000).toFixed(1) + "s"
      : null

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <button
        className="flex items-center gap-2 w-full px-3 py-2.5 bg-muted/50 hover:bg-muted transition-colors text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span className="text-muted-foreground">{TOOL_ICONS[toolCall.name] ?? <Search size={14} />}</span>
        <span className="text-sm font-medium flex-1">{TOOL_LABELS[toolCall.name] ?? toolCall.name}</span>
        {statusIcon}
        {elapsed && <span className="text-xs text-muted-foreground">{elapsed}</span>}
        <Badge
          variant={toolCall.status === "done" ? "secondary" : toolCall.status === "error" ? "destructive" : "outline"}
          className="text-xs"
        >
          {
            { pending: "等待中", running: "执行中", done: "完成", error: "失败" }[toolCall.status]
          }
        </Badge>
      </button>

      {/* Body */}
      {expanded && (
        <div className="p-3 space-y-3">
          {/* Input */}
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">输入</div>
            <pre className="text-xs bg-muted rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
              {JSON.stringify(toolCall.input, null, 2)}
            </pre>
          </div>

          {/* Output */}
          {toolCall.output !== undefined && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">输出</div>
              <ToolOutput toolName={toolCall.name} output={toolCall.output} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ToolOutput({ toolName, output }: { toolName: string; output: unknown }) {
  if (toolName === "generate_image" && typeof output === "object" && output !== null) {
    const { url, revisedPrompt, error } = output as { url?: string; revisedPrompt?: string; error?: string }
    if (url) {
      return (
        <div className="space-y-2">
          <img src={url} alt="Generated" className="rounded-lg max-w-full border border-border" />
          {revisedPrompt && (
            <div className="text-xs text-muted-foreground">{revisedPrompt}</div>
          )}
        </div>
      )
    }
    if (error) {
      return <div className="text-xs text-destructive">{error}</div>
    }
  }

  if (toolName === "web_search" && typeof output === "object" && output !== null) {
    const { abstract, abstractURL, relatedTopics } = output as {
      abstract?: string
      abstractURL?: string
      relatedTopics?: Array<{ text: string; url: string }>
    }
    return (
      <div className="space-y-2 text-xs">
        {abstract && (
          <p className="text-foreground leading-relaxed">{abstract}</p>
        )}
        {abstractURL && (
          <a href={abstractURL} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline break-all">
            {abstractURL}
          </a>
        )}
        {relatedTopics && relatedTopics.length > 0 && (
          <div>
            <div className="font-medium text-muted-foreground mb-1">相关内容</div>
            <ul className="space-y-1">
              {relatedTopics.map((t, i) => (
                <li key={i} className="text-muted-foreground">{t.text}</li>
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
