"use client"

import { useState } from "react"
import { Plus, Trash2, Pencil, Check, X } from "lucide-react"
import { useCopywritingConfigStore, type DropdownOption } from "@/lib/store/copywriting-config-store"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type OptionType = "topicTypes" | "hookTypes" | "copyTypes"

interface OptionListProps {
  options: DropdownOption[]
  type: OptionType
}

function OptionList({ options, type }: OptionListProps) {
  const { addOption, updateOption, deleteOption } = useCopywritingConfigStore()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingLabel, setEditingLabel] = useState("")
  const [newLabel, setNewLabel] = useState("")

  function startEdit(option: DropdownOption) {
    setEditingId(option.id)
    setEditingLabel(option.label)
  }

  function confirmEdit() {
    if (editingId && editingLabel.trim()) {
      updateOption(type, editingId, editingLabel.trim())
    }
    setEditingId(null)
    setEditingLabel("")
  }

  function cancelEdit() {
    setEditingId(null)
    setEditingLabel("")
  }

  function handleAdd() {
    const label = newLabel.trim()
    if (!label) return
    addOption(type, label)
    setNewLabel("")
  }

  return (
    <div className="space-y-2">
      <div className="space-y-1 max-h-[280px] overflow-y-auto pr-1">
        {options.map((opt) => (
          <div
            key={opt.id}
            className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2"
          >
            {editingId === opt.id ? (
              <>
                <Input
                  value={editingLabel}
                  onChange={(e) => setEditingLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") confirmEdit()
                    if (e.key === "Escape") cancelEdit()
                  }}
                  className="h-6 text-sm flex-1"
                  autoFocus
                />
                <button
                  onClick={confirmEdit}
                  className="text-primary hover:text-primary/80 transition-colors"
                >
                  <Check size={14} />
                </button>
                <button
                  onClick={cancelEdit}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X size={14} />
                </button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm">{opt.label}</span>
                <button
                  onClick={() => startEdit(opt)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={() => deleteOption(type, opt.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              </>
            )}
          </div>
        ))}
        {options.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">
            暂无选项，请添加
          </p>
        )}
      </div>

      {/* Add new */}
      <div className="flex items-center gap-2 pt-1">
        <Input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="输入新选项名称..."
          className="text-sm"
        />
        <Button size="sm" onClick={handleAdd} disabled={!newLabel.trim()} className="gap-1.5 shrink-0">
          <Plus size={13} />
          添加
        </Button>
      </div>
    </div>
  )
}

interface CopywritingConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CopywritingConfigDialog({ open, onOpenChange }: CopywritingConfigDialogProps) {
  const { topicTypes, hookTypes, copyTypes } = useCopywritingConfigStore()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>内容类型配置</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="topics">
          <TabsList className="w-full">
            <TabsTrigger value="topics" className="flex-1 text-xs">
              选题类型
            </TabsTrigger>
            <TabsTrigger value="hooks" className="flex-1 text-xs">
              钩子类型
            </TabsTrigger>
            <TabsTrigger value="copy" className="flex-1 text-xs">
              文案类型
            </TabsTrigger>
          </TabsList>

          <TabsContent value="topics" className="mt-3">
            <OptionList options={topicTypes} type="topicTypes" />
          </TabsContent>
          <TabsContent value="hooks" className="mt-3">
            <OptionList options={hookTypes} type="hookTypes" />
          </TabsContent>
          <TabsContent value="copy" className="mt-3">
            <OptionList options={copyTypes} type="copyTypes" />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
