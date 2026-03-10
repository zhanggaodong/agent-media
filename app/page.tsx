"use client"

import { useState, useEffect } from "react"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { CopywritingWorkflow } from "@/components/copywriting/copywriting-workflow"
import { LLMConfigDialog } from "@/components/settings/llm-config-dialog"
import { CopywritingConfigDialog } from "@/components/settings/copywriting-config-dialog"
import { useCopywritingWorkflowStore } from "@/lib/store/copywriting-workflow-store"
import { PenLine } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function HomePage() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [contentConfigOpen, setContentConfigOpen] = useState(false)
  const { activeProjectId, projects, createProject } = useCopywritingWorkflowStore()

  // Auto-create a project on first load if none exist
  useEffect(() => {
    if (projects.length === 0) {
      createProject()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenContentConfig={() => setContentConfigOpen(true)}
      />

      <main className="flex-1 overflow-hidden">
        {activeProjectId ? (
          <CopywritingWorkflow onOpenSettings={() => setSettingsOpen(true)} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <PenLine size={26} className="text-primary" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-base">开始创作文案</p>
              <p className="text-sm text-muted-foreground mt-1">
                点击左侧「新建文案」开始一个新项目
              </p>
            </div>
            <Button onClick={createProject} className="gap-2">
              新建文案项目
            </Button>
          </div>
        )}
      </main>

      <LLMConfigDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <CopywritingConfigDialog open={contentConfigOpen} onOpenChange={setContentConfigOpen} />
    </div>
  )
}
