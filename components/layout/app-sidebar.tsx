"use client"

import { Plus, FileText, Settings, Trash2, Sliders, PenLine } from "lucide-react"
import { useCopywritingWorkflowStore } from "@/lib/store/copywriting-workflow-store"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "@/lib/utils"

interface AppSidebarProps {
  onOpenSettings: () => void
  onOpenContentConfig: () => void
}

export function AppSidebar({ onOpenSettings, onOpenContentConfig }: AppSidebarProps) {
  const { projects, activeProjectId, deleteProject, setActiveProject, createProject } =
    useCopywritingWorkflowStore()

  return (
    <aside className="flex flex-col w-64 border-r border-border bg-sidebar h-full shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-4 border-b border-border">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground">
          <PenLine size={16} />
        </div>
        <div>
          <p className="font-semibold text-sm leading-none">文案创作平台</p>
          <p className="text-xs text-muted-foreground mt-0.5">自媒体文案生成</p>
        </div>
      </div>

      {/* New Project Button */}
      <div className="px-3 pt-3 pb-2">
        <Button className="w-full justify-center gap-2 text-sm py-2" onClick={createProject}>
          <Plus size={16} />
          新建文案
        </Button>
      </div>

      {/* Project List */}
      <ScrollArea className="flex-1 min-h-0 px-2">
        <div className="space-y-0.5 py-2">
          {projects.length === 0 && (
            <div className="text-xs text-muted-foreground text-center py-8">
              还没有项目，点击新建开始
            </div>
          )}
          {projects.map((proj) => (
            <div
              key={proj.id}
              className={cn(
                "group flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer hover:bg-accent text-sm transition-colors",
                activeProjectId === proj.id && "bg-accent"
              )}
              onClick={() => setActiveProject(proj.id)}
            >
              <FileText size={14} className="shrink-0 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <div className="truncate font-medium text-xs">{proj.title}</div>
                <div className="text-xs text-muted-foreground">
                  {proj.industry
                    ? proj.industry.slice(0, 12)
                    : formatDistanceToNow(proj.updatedAt)}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation()
                  deleteProject(proj.id)
                }}
              >
                <Trash2 size={12} />
              </Button>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t border-border p-2 space-y-0.5">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground"
          onClick={onOpenContentConfig}
        >
          <Sliders size={15} />
          内容类型配置
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground"
          onClick={onOpenSettings}
        >
          <Settings size={15} />
          模型配置
        </Button>
      </div>
    </aside>
  )
}
