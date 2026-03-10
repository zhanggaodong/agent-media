"use client"

import { useRef, useState, useCallback, useEffect } from "react"
import { useChatStore } from "@/lib/store/chat-store"
import { useConfigStore } from "@/lib/store/config-store"
import { getSkillById } from "@/lib/skills/registry"
import { MessageList } from "./message-list"
import { ChatInput } from "./chat-input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AlertCircle, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { SSEEvent, ToolStartData, ToolResultData, TextDeltaData } from "@/types"

interface ChatWorkspaceProps {
  conversationId: string
  onOpenSettings: () => void
}

export function ChatWorkspace({ conversationId, onOpenSettings }: ChatWorkspaceProps) {
  const conversation = useChatStore((s) => s.conversations.find((c) => c.id === conversationId))
  const { addMessage, updateMessage, appendMessageContent, addToolCall, updateToolCall, updateConversationTitle, clearPendingFirstMessage } =
    useChatStore()
  const config = useConfigStore((s) => s.getDefaultConfig())
  const imageConfig = useConfigStore((s) => s.imageConfig)
  const searchConfig = useConfigStore((s) => s.searchConfig)

  const [isStreaming, setIsStreaming] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const pendingFiredRef = useRef(false)

  const skill = conversation ? getSkillById(conversation.skillId) : null

  const handleSend = useCallback(
    async (userContent: string) => {
      if (!conversation || !config || isStreaming) return

      // Update title on first message
      if (conversation.messages.length === 0) {
        const title = `${skill?.icon ?? ""} ${userContent.slice(0, 30)}${userContent.length > 30 ? "..." : ""}`
        updateConversationTitle(conversationId, title)
      }

      // Add user message
      addMessage(conversationId, {
        role: "user",
        content: userContent,
        status: "done",
      })

      // Add assistant placeholder
      const assistantMsgId = addMessage(conversationId, {
        role: "assistant",
        content: "",
        status: "streaming",
        toolCalls: [],
      })

      setIsStreaming(true)

      const abortController = new AbortController()
      abortRef.current = abortController

      try {
        const messages = [
          ...conversation.messages.map((m) => ({ role: m.role, content: m.content })),
          { role: "user" as const, content: userContent },
        ]

        const res = await fetch("/api/chat/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages,
            skillId: conversation.skillId,
            config,
            ...(imageConfig && { imageConfig }),
            ...(searchConfig && { searchConfig }),
          }),
          signal: abortController.signal,
        })

        if (!res.ok) throw new Error(`HTTP ${res.status}`)

        const reader = res.body!.getReader()
        const decoder = new TextDecoder()
        let buffer = ""

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() ?? ""

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue
            const data = line.slice(6).trim()
            if (!data) continue

            const event: SSEEvent = JSON.parse(data)
            handleSSEEvent(event, conversationId, assistantMsgId)
          }
        }

        updateMessage(conversationId, assistantMsgId, { status: "done" })
      } catch (e) {
        if ((e as Error).name === "AbortError") {
          updateMessage(conversationId, assistantMsgId, { status: "done" })
        } else {
          updateMessage(conversationId, assistantMsgId, {
            status: "error",
            content: `错误：${String(e)}`,
          })
        }
      } finally {
        setIsStreaming(false)
        abortRef.current = null
      }
    },
    [conversation, config, isStreaming, conversationId, addMessage, updateMessage, appendMessageContent, addToolCall, updateToolCall, skill, updateConversationTitle]
  )

  // Auto-send pending first message (set from welcome screen)
  useEffect(() => {
    if (!pendingFiredRef.current && conversation?.pendingFirstMessage && config && !isStreaming) {
      pendingFiredRef.current = true
      const msg = conversation.pendingFirstMessage
      clearPendingFirstMessage(conversationId)
      handleSend(msg)
    }
  }, [conversation?.pendingFirstMessage, config, isStreaming])

  function handleSSEEvent(event: SSEEvent, convId: string, msgId: string) {
    switch (event.type) {
      case "text_delta": {
        const d = event.data as TextDeltaData
        appendMessageContent(convId, msgId, d.delta)
        break
      }
      case "tool_start": {
        const d = event.data as ToolStartData
        const toolCall = {
          id: d.toolCallId,
          name: d.toolName,
          input: d.input,
          status: "running" as const,
          startedAt: Date.now(),
        }
        addToolCall(convId, msgId, toolCall)
        break
      }
      case "tool_result": {
        const d = event.data as ToolResultData
        const patch = {
          status: d.isError ? ("error" as const) : ("done" as const),
          output: d.output,
          endedAt: Date.now(),
        }
        updateToolCall(convId, msgId, d.toolCallId, patch)
        break
      }
    }
  }

  function handleStop() {
    abortRef.current?.abort()
  }

  if (!conversation || !skill) return null

  // Check if config is set
  if (!config) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
        <AlertCircle size={40} className="text-muted-foreground" />
        <div>
          <div className="font-semibold mb-1">未配置 LLM</div>
          <div className="text-sm text-muted-foreground">请先配置模型的 API Key 才能开始对话</div>
        </div>
        <Button onClick={onOpenSettings} className="gap-2">
          <Settings size={16} />
          前往配置
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-background shrink-0">
        <span className="text-lg">{skill.icon}</span>
        <div>
          <div className="text-sm font-medium">{skill.name}</div>
          <div className="text-xs text-muted-foreground">
            {config.name} · {config.model}
          </div>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 max-w-3xl mx-auto">
          {conversation.messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
              <span className="text-5xl">{skill.icon}</span>
              <div className="text-base font-medium">{skill.name}</div>
              <div className="text-sm text-muted-foreground max-w-xs">{skill.description}</div>
            </div>
          ) : (
            <MessageList messages={conversation.messages} />
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        isStreaming={isStreaming}
        onStop={handleStop}
        disabled={false}
      />
    </div>
  )
}
