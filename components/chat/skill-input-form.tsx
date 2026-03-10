"use client"

import { useState } from "react"
import { Send } from "lucide-react"
import type { Skill } from "@/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface SkillInputFormProps {
  skill: Skill
  onSubmit: (content: string) => void
  disabled?: boolean
}

export function SkillInputForm({ skill, onSubmit, disabled }: SkillInputFormProps) {
  const [values, setValues] = useState<Record<string, string>>({})

  function handleSubmit() {
    if (!skill.inputForm) {
      onSubmit("请开始")
      return
    }
    const requiredFields = skill.inputForm.filter((f) => f.required)
    const allFilled = requiredFields.every((f) => values[f.key]?.trim())
    if (!allFilled) return

    // Build a natural language prompt from form values
    const parts = skill.inputForm
      .filter((f) => values[f.key])
      .map((f) => `${f.label}：${values[f.key]}`)
    onSubmit(parts.join("\n"))
  }

  if (!skill.inputForm || skill.inputForm.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <div className="text-4xl">{skill.icon}</div>
        <div className="text-lg font-semibold">{skill.name}</div>
        <div className="text-sm text-muted-foreground">{skill.description}</div>
        <Button onClick={() => onSubmit("你好，请介绍一下你能帮我做什么")} disabled={disabled}>
          开始对话
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto space-y-6 py-8">
      <div className="text-center">
        <div className="text-4xl mb-2">{skill.icon}</div>
        <div className="text-lg font-semibold">{skill.name}</div>
        <div className="text-sm text-muted-foreground">{skill.description}</div>
      </div>

      <div className="space-y-4">
        {skill.inputForm.map((field) => (
          <div key={field.key} className="space-y-1.5">
            <label className="text-sm font-medium">
              {field.label}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </label>
            {field.type === "textarea" ? (
              <Textarea
                placeholder={field.placeholder}
                value={values[field.key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                rows={4}
              />
            ) : field.type === "select" ? (
              <Select
                value={values[field.key]}
                onValueChange={(v: string | null) => setValues((prev) => ({ ...prev, [field.key]: v ?? "" }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="请选择..." />
                </SelectTrigger>
                <SelectContent>
                  {field.options?.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                placeholder={field.placeholder}
                value={values[field.key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
              />
            )}
          </div>
        ))}
      </div>

      <Button
        className="w-full gap-2"
        onClick={handleSubmit}
        disabled={disabled}
      >
        <Send size={16} />
        开始生成
      </Button>
    </div>
  )
}
