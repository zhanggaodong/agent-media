"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import {
  RefreshCw,
  Check,
  Loader2,
  Sparkles,
  ChevronRight,
  FileText,
  Zap,
  Layers,
  PenLine,
  Edit2,
  Save,
  Copy,
} from "lucide-react"
import {
  useCopywritingWorkflowStore,
  type CopywritingProject,
} from "@/lib/store/copywriting-workflow-store"
import { useCopywritingConfigStore } from "@/lib/store/copywriting-config-store"
import { useConfigStore } from "@/lib/store/config-store"
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
import { cn } from "@/lib/utils"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeRaw from "rehype-raw"

// ── Partial item extraction ────────────────────────────────────────────────────
// Given the accumulated raw text and how many items have been emitted so far,
// returns the text currently being streamed for the next (incomplete) item.

function extractPartialItem(text: string, stage: string, emittedCount: number): string {
  if (stage === "copy") {
    const parts = text.split(/={5,}/)
    const last = parts[parts.length - 1] ?? ""
    return last.replace(/^【\d+】\s*\n?/, "").trimStart()
  }

  // Numbered list: find where item (emittedCount+1) starts
  const n = emittedCount + 1
  const lines = text.split("\n")
  let startLine = -1
  for (let i = 0; i < lines.length; i++) {
    if (new RegExp(`^${n}[.、）)][ \t]`).test(lines[i])) {
      startLine = i
      break
    }
  }
  if (startLine === -1) return ""
  return lines
    .slice(startLine)
    .join("\n")
    .replace(new RegExp(`^${n}[.、）)][ \t]*`), "")
    .trim()
}

// ── Generation hook ───────────────────────────────────────────────────────────
// Items arrive one-by-one via SSE "item" events.
// text_delta events stream raw LLM output for live preview.
// onProgress is called with the growing array after each new item.

function useGenerate() {
  const [isGenerating, setIsGenerating] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [streamingItem, setStreamingItem] = useState<string>("")
  const abortRef = useRef<AbortController | null>(null)
  const accRef = useRef<string[]>([]) // accumulator between renders
  const rawBufferRef = useRef<string>("")
  const emittedCountRef = useRef<number>(0)
  const stageRef = useRef<string>("")

  const generate = useCallback(
    async (
      stage: string,
      input: Record<string, string>,
      config: { apiKey: string; baseURL?: string; model: string; enableBuiltinSearch?: boolean },
      onProgress: (items: string[]) => void
    ) => {
      abortRef.current?.abort()
      const abort = new AbortController()
      abortRef.current = abort
      accRef.current = []
      rawBufferRef.current = ""
      emittedCountRef.current = 0
      stageRef.current = stage

      setIsGenerating(true)
      setIsThinking(false)
      setError(null)
      setStreamingItem("")

      try {
        const response = await fetch("/api/copywriting/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stage, input, config }),
          signal: abort.signal,
        })

        if (!response.ok) throw new Error(`HTTP ${response.status}`)

        const reader = response.body!.getReader()
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
            const raw = line.slice(6).trim()
            try {
              const event = JSON.parse(raw)
              if (event.type === "thinking") {
                setIsThinking(true)
              } else if (event.type === "text_delta") {
                setIsThinking(false)
                rawBufferRef.current += event.data.content as string
                const partial = extractPartialItem(
                  rawBufferRef.current,
                  stageRef.current,
                  emittedCountRef.current
                )
                setStreamingItem(partial)
              } else if (event.type === "item") {
                const next = [...accRef.current]
                next[event.data.index as number] = event.data.item as string
                accRef.current = next
                emittedCountRef.current = next.filter(Boolean).length
                onProgress([...next])
                // Recompute partial for the next item now being built
                const partial = extractPartialItem(
                  rawBufferRef.current,
                  stageRef.current,
                  emittedCountRef.current
                )
                setStreamingItem(partial)
              } else if (event.type === "error") {
                setError(event.data.message as string)
              }
            } catch {
              // skip malformed SSE lines
            }
          }
        }
      } catch (e: unknown) {
        if ((e as Error).name !== "AbortError") {
          setError(String(e))
        }
      } finally {
        setIsGenerating(false)
        setIsThinking(false)
        setStreamingItem("")
      }
    },
    []
  )

  return { generate, isGenerating, isThinking, error, streamingItem }
}

// ── Item card grid ────────────────────────────────────────────────────────────

interface ItemGridProps {
  items: string[]
  selectedIndex: number | null
  onSelect: (index: number) => void
  onEdit?: (index: number, newValue: string) => void
  isCopy?: boolean
  editable?: boolean
}

function ItemGrid({ items, selectedIndex, onSelect, onEdit, isCopy, editable = false }: ItemGridProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editValue, setEditValue] = useState("")
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  const handleEditStart = (i: number, item: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingIndex(i)
    setEditValue(item)
  }

  const handleEditSave = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (editingIndex !== null && onEdit) {
      onEdit(editingIndex, editValue)
    }
    setEditingIndex(null)
  }

  const handleEditCancel = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingIndex(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      if (editingIndex !== null && onEdit) {
        onEdit(editingIndex, editValue)
      }
      setEditingIndex(null)
    } else if (e.key === "Escape") {
      setEditingIndex(null)
    }
  }

  return (
    <div className={cn("grid gap-2", isCopy ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2")}>
      {items.map((item, i) =>
        isCopy ? (
          // Copy cards use div (markdown renders block elements inside)
          <div
            key={i}
            className="group relative rounded-lg border p-3 text-sm transition-all hover:border-primary/50 hover:bg-accent border-border bg-background"
          >
            <div className="flex gap-1.5">
              <span className="text-xs font-semibold text-muted-foreground shrink-0 mt-0.5">{i + 1}.</span>
              <div className="min-w-0 prose-sm max-w-none text-sm leading-relaxed
                [&_p]:mb-2 [&_p:last-child]:mb-0
                [&_h1]:text-base [&_h1]:font-bold [&_h1]:mt-3 [&_h1]:mb-1.5 [&_h1:first-child]:mt-0
                [&_h2]:text-sm [&_h2]:font-bold [&_h2]:mt-2.5 [&_h2]:mb-1 [&_h2:first-child]:mt-0
                [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1 [&_h3:first-child]:mt-0
                [&_ul]:mb-2 [&_ul]:ml-4 [&_ul]:list-disc
                [&_ol]:mb-2 [&_ol]:ml-4 [&_ol]:list-decimal
                [&_li]:leading-relaxed
                [&_strong]:font-semibold
                [&_em]:italic
                [&_blockquote]:border-l-2 [&_blockquote]:border-current/30 [&_blockquote]:pl-3 [&_blockquote]:my-2 [&_blockquote]:opacity-80 [&_blockquote]:italic
                [&_hr]:my-2 [&_hr]:border-current/20
                [&_br]:block
                [&_table]:my-2 [&_table]:w-full [&_table]:border-collapse [&_table]:text-xs
                [&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:font-semibold [&_th]:bg-muted/50
                [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1
                [&_code]:bg-black/5 [&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.8em] [&_code]:font-mono
                [&_pre]:bg-black/5 [&_pre]:rounded [&_pre]:p-2 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:text-xs [&_pre]:font-mono">
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{item}</ReactMarkdown>
              </div>
            </div>
            {/* Copy button for final copy */}
            <span
              onClick={(e) => {
                e.stopPropagation()
                navigator.clipboard.writeText(item)
                setCopiedIndex(i)
                setTimeout(() => setCopiedIndex(null), 2000)
              }}
              className="absolute right-2 bottom-2 opacity-0 group-hover:opacity-100 transition-opacity flex h-6 w-6 items-center justify-center rounded-full bg-black text-white cursor-pointer"
              title="复制文案"
            >
              <Copy size={12} />
            </span>
            {/* Copy success tooltip */}
            {copiedIndex === i && (
              <span className="absolute right-2 bottom-9 bg-black text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap">
                已复制
              </span>
            )}
          </div>
        ) : editingIndex === i ? (
          // Editing mode
          <div
            key={i}
            className={cn(
              "relative rounded-lg border p-3 text-sm",
              selectedIndex === i
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border bg-background"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex gap-1.5">
              <span className="text-xs font-semibold text-muted-foreground shrink-0 mt-0.5">{i + 1}.</span>
              <Textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={handleKeyDown}
                className="min-h-[80px] resize-none text-sm"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <Button variant="ghost" size="sm" onClick={handleEditCancel} className="h-7 px-2 cursor-pointer">
                取消
              </Button>
              <Button variant="default" size="sm" onClick={handleEditSave} className="h-7 px-2 gap-1 cursor-pointer">
                <Save size={12} />
                保存
              </Button>
            </div>
          </div>
        ) : (
          <button
            key={i}
            onClick={() => onSelect(i)}
            className={cn(
              "group relative text-left rounded-lg border p-3 text-sm transition-all hover:border-primary/50 hover:bg-accent",
              selectedIndex === i
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border bg-background"
            )}
          >
            <span className="mr-1 text-xs font-semibold text-muted-foreground">{i + 1}.</span>
            <span className="leading-relaxed">{item}</span>
            {editable && (
              <span
                onClick={(e) => handleEditStart(i, item, e)}
                className="absolute right-2 bottom-2 opacity-0 group-hover:opacity-100 transition-opacity flex h-6 px-2 items-center justify-center rounded-full bg-black text-white text-xs cursor-pointer"
              >
                编辑
              </span>
            )}
          </button>
        )
      )}
    </div>
  )
}

// ── Streaming preview card ─────────────────────────────────────────────────────
// Shows live LLM output while the current item is being generated.

function StreamingCard({ text, index, isThinking }: { text: string; index: number; isThinking?: boolean }) {
  if (!text) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 p-3 text-xs text-muted-foreground">
        <Loader2 size={13} className="animate-spin shrink-0" />
        <span>{isThinking ? "AI 正在思考，即将开始生成..." : `正在生成第 ${index + 1} 条...`}</span>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3 text-sm">
      <div className="flex gap-1.5">
        <span className="text-xs font-semibold text-muted-foreground shrink-0 mt-0.5">
          {index + 1}.
        </span>
        <span className="leading-relaxed text-foreground/70 whitespace-pre-wrap break-words min-w-0">
          {text}
          <span className="inline-block w-px h-[1em] bg-primary/60 ml-0.5 align-middle animate-pulse" />
        </span>
      </div>
    </div>
  )
}

// ── Section wrapper ───────────────────────────────────────────────────────────

interface SectionProps {
  step: number
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}

function Section({ step, icon, title, children }: SectionProps) {
  return (
    <div className="border border-border rounded-xl bg-card overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">
          {step}
        </div>
        <div className="flex items-center gap-1.5 text-sm font-semibold">
          {icon}
          {title}
        </div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

// ── No config notice ─────────────────────────────────────────────────────────

function NoConfigNotice({ onOpenSettings }: { onOpenSettings: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
        <Zap size={20} className="text-muted-foreground" />
      </div>
      <div>
        <p className="font-medium text-sm mb-1">尚未配置 AI 模型</p>
        <p className="text-xs text-muted-foreground">请先配置模型 API Key 才能开始生成文案</p>
      </div>
      <Button size="sm" onClick={onOpenSettings}>
        去配置模型
      </Button>
    </div>
  )
}

// ── Main workflow component ───────────────────────────────────────────────────

interface CopywritingWorkflowProps {
  onOpenSettings: () => void
}

export function CopywritingWorkflow({ onOpenSettings }: CopywritingWorkflowProps) {
  const { activeProjectId, getActiveProject, updateProject } = useCopywritingWorkflowStore()
  const { topicTypes, hookTypes, copyTypes } = useCopywritingConfigStore()
  const getDefaultConfig = useConfigStore((s) => s.getDefaultConfig)

  const project = getActiveProject()

  // Per-stage generation state
  const topicsGen = useGenerate()
  const hooksGen = useGenerate()
  const coreGen = useGenerate()
  const copyGen = useGenerate()

  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll when new sections appear
  useEffect(() => {
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
    }, 100)
    return () => clearTimeout(timer)
  }, [
    project?.generatedTopics.length,
    project?.selectedTopicIndex,
    project?.generatedHooks.length,
    project?.selectedHookIndex,
    project?.generatedCoreElements.length,
    project?.selectedCoreElementIndex,
    project?.generatedCopies.length,
  ])

  if (!project || !activeProjectId) {
    return null
  }

  const config = getDefaultConfig()
  if (!config) {
    return <NoConfigNotice onOpenSettings={onOpenSettings} />
  }

  function updateField<K extends keyof CopywritingProject>(key: K, value: CopywritingProject[K]) {
    updateProject(activeProjectId!, { [key]: value } as Partial<CopywritingProject>)
  }

  // ── Step 1 handlers ──────────────────────────────────────────────────────

  function handleGenerateTopics() {
    if (!project!.topicType || !project!.industry) return
    const title =
      project!.industry.slice(0, 16) +
      (project!.initialIdea ? ` · ${project!.initialIdea.slice(0, 10)}` : "")
    // Reset downstream once at the START of generation
    updateProject(activeProjectId!, {
      title,
      generatedTopics: [],
      selectedTopicIndex: null,
      hookType: "",
      generatedHooks: [],
      selectedHookIndex: null,
      generatedCoreElements: [],
      selectedCoreElementIndex: null,
      copyType: "",
      generatedCopies: [],
      selectedCopyIndex: null,
    })
    topicsGen.generate(
      "topics",
      {
        industry: project!.industry,
        ipPositioning: project!.ipPositioning,
        initialIdea: project!.initialIdea,
        topicType: project!.topicType,
      },
      config!,
      // Each call adds one more item — only update generatedTopics
      (currentItems) => updateProject(activeProjectId!, { generatedTopics: currentItems })
    )
  }

  // ── Step 2 handlers ──────────────────────────────────────────────────────

  function handleSelectTopic(index: number) {
    updateProject(activeProjectId!, {
      selectedTopicIndex: index,
      hookType: "",
      generatedHooks: [],
      selectedHookIndex: null,
      generatedCoreElements: [],
      selectedCoreElementIndex: null,
      copyType: "",
      generatedCopies: [],
      selectedCopyIndex: null,
    })
  }

  // ── Step 3 handlers ──────────────────────────────────────────────────────

  function handleGenerateHooks() {
    if (project!.selectedTopicIndex === null || !project!.hookType) return
    const selectedTopic = project!.generatedTopics[project!.selectedTopicIndex]
    updateProject(activeProjectId!, {
      generatedHooks: [],
      selectedHookIndex: null,
      generatedCoreElements: [],
      selectedCoreElementIndex: null,
      copyType: "",
      generatedCopies: [],
      selectedCopyIndex: null,
    })
    hooksGen.generate(
      "hooks",
      { selectedTopic, hookType: project!.hookType },
      config!,
      (currentItems) => updateProject(activeProjectId!, { generatedHooks: currentItems })
    )
  }

  function handleSelectHook(index: number) {
    updateProject(activeProjectId!, {
      selectedHookIndex: index,
      generatedCoreElements: [],
      selectedCoreElementIndex: null,
      copyType: "",
      generatedCopies: [],
      selectedCopyIndex: null,
    })
  }

  // ── Step 4 handlers ──────────────────────────────────────────────────────

  function handleGenerateCoreElements() {
    if (project!.selectedTopicIndex === null || project!.selectedHookIndex === null) return
    const selectedTopic = project!.generatedTopics[project!.selectedTopicIndex]
    const selectedHook = project!.generatedHooks[project!.selectedHookIndex]
    updateProject(activeProjectId!, {
      generatedCoreElements: [],
      selectedCoreElementIndex: null,
      copyType: "",
      generatedCopies: [],
      selectedCopyIndex: null,
    })
    coreGen.generate(
      "core_elements",
      { selectedTopic, selectedHook },
      config!,
      (currentItems) => updateProject(activeProjectId!, { generatedCoreElements: currentItems })
    )
  }

  function handleSelectCoreElement(index: number) {
    updateProject(activeProjectId!, {
      selectedCoreElementIndex: index,
      copyType: "",
      generatedCopies: [],
      selectedCopyIndex: null,
    })
  }

  // ── Step 5 handlers ──────────────────────────────────────────────────────

  function handleGenerateCopy() {
    if (
      project!.selectedTopicIndex === null ||
      project!.selectedHookIndex === null ||
      project!.selectedCoreElementIndex === null ||
      !project!.copyType
    )
      return
    const selectedTopic = project!.generatedTopics[project!.selectedTopicIndex]
    const selectedHook = project!.generatedHooks[project!.selectedHookIndex]
    const selectedCoreElement = project!.generatedCoreElements[project!.selectedCoreElementIndex]
    updateProject(activeProjectId!, { generatedCopies: [], selectedCopyIndex: null })
    copyGen.generate(
      "copy",
      { selectedTopic, selectedHook, selectedCoreElement, copyType: project!.copyType },
      config!,
      (currentItems) => updateProject(activeProjectId!, { generatedCopies: currentItems })
    )
  }

  const showTopics = topicsGen.isGenerating || project.generatedTopics.length > 0
  const showHooks = project.selectedTopicIndex !== null
  const showCore = project.selectedHookIndex !== null
  const showCopy = project.selectedCoreElementIndex !== null

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto">
      <div className="max-w-[95%] mx-auto px-4 py-6 space-y-4">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold tracking-tight">自媒体文案生成</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            填写基本信息，逐步生成专业文案
          </p>
        </div>

        {/* Step 1: Basic Info */}
        <Section step={1} icon={<FileText size={14} />} title="基本信息">
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  行业 / 产品 <span className="text-destructive">*</span>
                </label>
                <Input
                  placeholder="例如：护肤品、健身课程、编程教育"
                  value={project.industry}
                  onChange={(e) => updateField("industry", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">IP 定位</label>
                <Input
                  placeholder="例如：宝妈、职场人、大学生"
                  value={project.ipPositioning}
                  onChange={(e) => updateField("ipPositioning", e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">初步想法</label>
              <Textarea
                placeholder="描述你想表达的核心内容或创作灵感..."
                value={project.initialIdea}
                onChange={(e) => updateField("initialIdea", e.target.value)}
                className="resize-none min-h-[72px]"
                rows={3}
              />
            </div>
            <div className="flex items-center gap-3">
              <div className="space-y-1 flex-1">
                <label className="text-xs font-medium text-muted-foreground">
                  选题类型 <span className="text-destructive">*</span>
                </label>
                <Select
                  value={project.topicType}
                  onValueChange={(v) => {
                    updateProject(activeProjectId, {
                      topicType: v ?? "",
                      generatedTopics: [],
                      selectedTopicIndex: null,
                      hookType: "",
                      generatedHooks: [],
                      selectedHookIndex: null,
                      generatedCoreElements: [],
                      selectedCoreElementIndex: null,
                      copyType: "",
                      generatedCopies: [],
                      selectedCopyIndex: null,
                    })
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="请选择选题类型" />
                  </SelectTrigger>
                  <SelectContent>
                    {topicTypes.map((t) => (
                      <SelectItem key={t.id} value={t.label}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="pt-5">
                <Button
                  onClick={handleGenerateTopics}
                  disabled={!project.industry || !project.topicType || topicsGen.isGenerating}
                  className="gap-2 cursor-pointer"
                >
                  {topicsGen.isGenerating ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Sparkles size={14} />
                  )}
                  {topicsGen.isGenerating ? "生成中..." : "生成选题"}
                </Button>
              </div>
            </div>
            {topicsGen.error && (
              <p className="text-xs text-destructive">{topicsGen.error}</p>
            )}
          </div>
        </Section>

        {/* Step 2: Topics */}
        {showTopics && (
          <Section step={2} icon={<ChevronRight size={14} />} title="选择选题">
            <div className="space-y-2">
              {project.generatedTopics.length > 0 && (
                <ItemGrid
                  items={project.generatedTopics}
                  selectedIndex={project.selectedTopicIndex}
                  onSelect={handleSelectTopic}
                  editable
                  onEdit={(i, v) => {
                    const newTopics = [...project.generatedTopics]
                    newTopics[i] = v
                    updateProject(activeProjectId, { generatedTopics: newTopics })
                  }}
                />
              )}
              {topicsGen.isGenerating && (
                <StreamingCard text={topicsGen.streamingItem} index={project.generatedTopics.length} isThinking={topicsGen.isThinking} />
              )}
              {!topicsGen.isGenerating && project.generatedTopics.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateTopics}
                  className="gap-1.5"
                >
                  <RefreshCw size={13} />
                  重新生成
                </Button>
              )}
              {topicsGen.error && (
                <p className="text-xs text-destructive">{topicsGen.error}</p>
              )}
            </div>
          </Section>
        )}

        {/* Step 3: Hooks */}
        {showHooks && (
          <Section step={3} icon={<Zap size={14} />} title="黄金钩子">
            <div className="space-y-3">
              {project.selectedTopicIndex !== null && (
                <div className="flex items-center gap-3">
                  <div className="space-y-1 flex-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      钩子类型 <span className="text-destructive">*</span>
                    </label>
                    <Select
                      value={project.hookType}
                      onValueChange={(v) =>
                        updateProject(activeProjectId, {
                          hookType: v ?? "",
                          generatedHooks: [],
                          selectedHookIndex: null,
                          generatedCoreElements: [],
                          selectedCoreElementIndex: null,
                          copyType: "",
                          generatedCopies: [],
                          selectedCopyIndex: null,
                        })
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="请选择钩子类型" />
                      </SelectTrigger>
                      <SelectContent>
                        {hookTypes.map((t) => (
                          <SelectItem key={t.id} value={t.label}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="pt-5">
                    <Button
                      onClick={handleGenerateHooks}
                      disabled={
                        !project.hookType ||
                        project.selectedTopicIndex === null ||
                        hooksGen.isGenerating
                      }
                      className="gap-2 cursor-pointer"
                    >
                      {hooksGen.isGenerating ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Sparkles size={14} />
                      )}
                      {hooksGen.isGenerating ? "生成中..." : "生成钩子"}
                    </Button>
                  </div>
                </div>
              )}

              {project.generatedHooks.length > 0 && (
                <ItemGrid
                  items={project.generatedHooks}
                  selectedIndex={project.selectedHookIndex}
                  onSelect={handleSelectHook}
                  editable
                  onEdit={(i, v) => {
                    const newHooks = [...project.generatedHooks]
                    newHooks[i] = v
                    updateProject(activeProjectId, { generatedHooks: newHooks })
                  }}
                />
              )}
              {hooksGen.isGenerating && (
                <StreamingCard text={hooksGen.streamingItem} index={project.generatedHooks.length} isThinking={hooksGen.isThinking} />
              )}
              {!hooksGen.isGenerating && project.generatedHooks.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateHooks}
                  className="gap-1.5"
                >
                  <RefreshCw size={13} />
                  重新生成
                </Button>
              )}
              {hooksGen.error && (
                <p className="text-xs text-destructive">{hooksGen.error}</p>
              )}
            </div>
          </Section>
        )}

        {/* Step 4: Core Elements */}
        {showCore && (
          <Section step={4} icon={<Layers size={14} />} title="文案核心要素">
            <div className="space-y-3">
              {project.selectedHookIndex !== null && project.generatedCoreElements.length === 0 && !coreGen.isGenerating && (
                <div className="flex items-center gap-3">
                  <p className="text-sm text-muted-foreground flex-1">
                    已选定钩子，点击生成文案核心要素
                  </p>
                  <Button onClick={handleGenerateCoreElements} className="gap-2 cursor-pointer" disabled={coreGen.isGenerating}>
                    <Sparkles size={14} />
                    生成核心要素
                  </Button>
                </div>
              )}

              {project.generatedCoreElements.length > 0 && (
                <ItemGrid
                  items={project.generatedCoreElements}
                  selectedIndex={project.selectedCoreElementIndex}
                  onSelect={handleSelectCoreElement}
                  editable
                  onEdit={(i, v) => {
                    const newElements = [...project.generatedCoreElements]
                    newElements[i] = v
                    updateProject(activeProjectId, { generatedCoreElements: newElements })
                  }}
                />
              )}
              {coreGen.isGenerating && (
                <StreamingCard text={coreGen.streamingItem} index={project.generatedCoreElements.length} isThinking={coreGen.isThinking} />
              )}
              {!coreGen.isGenerating && project.generatedCoreElements.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateCoreElements}
                  className="gap-1.5"
                >
                  <RefreshCw size={13} />
                  重新生成
                </Button>
              )}
              {coreGen.error && (
                <p className="text-xs text-destructive">{coreGen.error}</p>
              )}
            </div>
          </Section>
        )}

        {/* Step 5: Final Copy */}
        {showCopy && (
          <Section step={5} icon={<PenLine size={14} />} title="最终文案">
            <div className="space-y-3">
              {project.selectedCoreElementIndex !== null && (
                <div className="flex items-center gap-3">
                  <div className="space-y-1 flex-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      文案类型 <span className="text-destructive">*</span>
                    </label>
                    <Select
                      value={project.copyType}
                      onValueChange={(v) =>
                        updateProject(activeProjectId, {
                          copyType: v ?? "",
                          generatedCopies: [],
                          selectedCopyIndex: null,
                        })
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="请选择文案类型" />
                      </SelectTrigger>
                      <SelectContent>
                        {copyTypes.map((t) => (
                          <SelectItem key={t.id} value={t.label}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="pt-5">
                    <Button
                      onClick={handleGenerateCopy}
                      disabled={
                        !project.copyType ||
                        project.selectedCoreElementIndex === null ||
                        copyGen.isGenerating
                      }
                      className="gap-2 cursor-pointer"
                    >
                      {copyGen.isGenerating ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Sparkles size={14} />
                      )}
                      {copyGen.isGenerating ? "生成中..." : "生成文案"}
                    </Button>
                  </div>
                </div>
              )}

              {project.generatedCopies.length > 0 && (
                <ItemGrid
                  items={project.generatedCopies}
                  selectedIndex={project.selectedCopyIndex}
                  onSelect={(i) => updateField("selectedCopyIndex", i)}
                  isCopy
                />
              )}
              {copyGen.isGenerating && (
                <StreamingCard text={copyGen.streamingItem} index={project.generatedCopies.length} isThinking={copyGen.isThinking} />
              )}
              {!copyGen.isGenerating && project.generatedCopies.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateCopy}
                  className="gap-1.5"
                >
                  <RefreshCw size={13} />
                  重新生成
                </Button>
              )}

              {copyGen.error && (
                <p className="text-xs text-destructive">{copyGen.error}</p>
              )}
            </div>
          </Section>
        )}

        {/* Bottom padding */}
        <div className="h-8" />
      </div>
    </div>
  )
}
