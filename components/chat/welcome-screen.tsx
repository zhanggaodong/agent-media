"use client"

import { useState, useRef, KeyboardEvent } from "react"
import { Send, X } from "lucide-react"
import { SKILLS } from "@/lib/skills/registry"
import { useChatStore } from "@/lib/store/chat-store"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

// 只展示非通用助手作为可选智能体，通用助手是默认值
const AGENT_OPTIONS = SKILLS.filter((s) => s.id !== "general")

export function WelcomeScreen() {
  const { createConversation } = useChatStore()
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null)
  const [value, setValue] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const selectedSkill = selectedSkillId ? SKILLS.find((s) => s.id === selectedSkillId) : null
  const effectiveSkillId = selectedSkillId ?? "general"

  function handleSend() {
    const trimmed = value.trim()
    if (!trimmed) return
    const skill = SKILLS.find((s) => s.id === effectiveSkillId)!
    const title = `${skill.icon} ${trimmed.slice(0, 30)}${trimmed.length > 30 ? "..." : ""}`
    createConversation(effectiveSkillId, title, trimmed)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function toggleAgent(skillId: string) {
    setSelectedSkillId((prev) => (prev === skillId ? null : skillId))
  }

  return (
    <div className="flex flex-col items-center justify-center h-full px-4">
      <div className="w-full max-w-2xl space-y-4">
        {/* Greeting */}
        <div className="text-center space-y-1 mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">你好，有什么可以帮你？</h1>
          <p className="text-sm text-muted-foreground">直接输入问题，或选择下方智能体开始对话</p>
        </div>

        {/* Input box */}
        <div className="relative rounded-xl border border-border bg-background shadow-sm focus-within:border-ring transition-colors">
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入你的问题...（Enter 发送，Shift+Enter 换行）"
            className="resize-none border-0 shadow-none focus-visible:ring-0 min-h-[100px] max-h-[240px] text-sm pb-12 pr-14"
            rows={3}
          />

          {/* Send button - bottom right inside box */}
          <Button
            size="icon"
            className={cn(
              "absolute right-3 bottom-3 h-8 w-8 rounded-lg",
              !value.trim() && "opacity-40"
            )}
            onClick={handleSend}
            disabled={!value.trim()}
          >
            <Send size={14} />
          </Button>

          {/* Selected agent badge - bottom left inside box */}
          {selectedSkill && (
            <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 rounded-full px-2.5 py-1 text-xs font-medium">
              <span>{selectedSkill.icon}</span>
              <span>{selectedSkill.name}</span>
              <button
                onClick={() => setSelectedSkillId(null)}
                className="ml-0.5 hover:text-destructive transition-colors"
              >
                <X size={10} />
              </button>
            </div>
          )}
        </div>

        {/* Agent selector */}
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {AGENT_OPTIONS.map((skill) => (
            <button
              key={skill.id}
              onClick={() => toggleAgent(skill.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all",
                selectedSkillId === skill.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:border-primary/40 hover:bg-accent text-muted-foreground hover:text-foreground"
              )}
            >
              <span>{skill.icon}</span>
              <span>{skill.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
