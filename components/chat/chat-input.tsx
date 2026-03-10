"use client"

import { useState, useRef, KeyboardEvent } from "react"
import { Send, Square } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

interface ChatInputProps {
  onSend: (content: string) => void
  isStreaming: boolean
  onStop?: () => void
  disabled?: boolean
  placeholder?: string
}

export function ChatInput({ onSend, isStreaming, onStop, disabled, placeholder }: ChatInputProps) {
  const [value, setValue] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function handleSend() {
    const trimmed = value.trim()
    if (!trimmed || isStreaming || disabled) return
    onSend(trimmed)
    setValue("")
    textareaRef.current?.focus()
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="bg-background pb-4">
      <div className="p-4 max-w-3xl mx-auto border border-border rounded-2xl">
      <div className="flex gap-3 items-end max-w-full">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? "输入消息...（Enter 发送，Shift+Enter 换行）"}
          className="resize-none border-none outline-none rounded-md min-h-[44px] max-h-[200px]"
          rows={1}
          disabled={disabled || isStreaming}
        />
        {isStreaming ? (
          <Button
            size="icon"
            variant="outline"
            className="shrink-0 h-[44px] w-[44px]"
            onClick={onStop}
          >
            <Square size={16} />
          </Button>
        ) : (
          <Button
            size="icon"
            className={cn("shrink-0 h-[44px] w-[44px]", !value.trim() && "opacity-50")}
            onClick={handleSend}
            disabled={!value.trim() || disabled}
          >
            <Send size={16} />
          </Button>
        )}
      </div>
    </div>
      <div className="text-xs text-muted-foreground mt-2 text-center">
        AI 生成内容仅供参考，请核实重要信息
      </div>
    </div>
  )
}
