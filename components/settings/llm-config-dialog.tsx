"use client"

import { useState } from "react"
import { Plus, Trash2, Check, Eye, EyeOff, Globe, Pencil, Bot, Image, Search } from "lucide-react"
import { useConfigStore } from "@/lib/store/config-store"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { LLMConfig, LLMProvider, ImageModelConfig, SearchConfig } from "@/types"

const MODEL_PRESETS: Record<string, string[]> = {
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
  anthropic: ["claude-opus-4-6", "claude-sonnet-4-6", "claude-haiku-4-5-20251001"],
  custom: [],
}

interface LLMConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LLMConfigDialog({ open, onOpenChange }: LLMConfigDialogProps) {
  const {
    configs, addConfig, updateConfig, deleteConfig, setDefault, defaultConfigId,
    imageConfig, setImageConfig,
    searchConfig, setSearchConfig,
  } = useConfigStore()

  // ── 通用模型 state ──
  const [form, setForm] = useState<Partial<LLMConfig>>({
    provider: "openai", model: "gpt-4o", name: "", apiKey: "", baseURL: "", enableBuiltinSearch: false,
  })
  const [showKey, setShowKey] = useState(false)
  const [adding, setAdding] = useState(configs.length === 0)
  const [editingId, setEditingId] = useState<string | null>(null)

  // ── 图片模型 state ──
  const [imageForm, setImageForm] = useState<ImageModelConfig>(
    imageConfig ?? { model: "", apiKey: "", baseURL: "" }
  )
  const [showImageKey, setShowImageKey] = useState(false)
  const [editingImage, setEditingImage] = useState(!imageConfig)

  // ── 搜索模型 state ──
  const [searchForm, setSearchForm] = useState<SearchConfig>(
    searchConfig ?? { provider: "", apiKey: "", baseURL: "" }
  )
  const [showSearchKey, setShowSearchKey] = useState(false)
  const [editingSearch, setEditingSearch] = useState(!searchConfig)

  // ── 通用模型 handlers ──
  function handleSaveLLM() {
    if (!form.name || !form.apiKey || !form.model) return
    if (editingId) {
      updateConfig(editingId, {
        name: form.name!, provider: form.provider!, model: form.model!,
        apiKey: form.apiKey!, baseURL: form.baseURL || undefined,
        enableBuiltinSearch: form.enableBuiltinSearch ?? false,
      })
      setEditingId(null)
    } else {
      addConfig({
        name: form.name!, provider: form.provider!, model: form.model!,
        apiKey: form.apiKey!, baseURL: form.baseURL || undefined,
        enableBuiltinSearch: form.enableBuiltinSearch ?? false,
      })
    }
    setForm({ provider: "openai", model: "gpt-4o", name: "", apiKey: "", baseURL: "", enableBuiltinSearch: false })
    setAdding(false)
  }

  function handleEditLLM(cfg: LLMConfig) {
    setForm({
      name: cfg.name, provider: cfg.provider, model: cfg.model,
      apiKey: cfg.apiKey, baseURL: cfg.baseURL ?? "", enableBuiltinSearch: cfg.enableBuiltinSearch ?? false,
    })
    setEditingId(cfg.id)
    setAdding(true)
  }

  function cancelAddLLM() {
    setAdding(false)
    setEditingId(null)
    setForm({ provider: "openai", model: "gpt-4o", name: "", apiKey: "", baseURL: "", enableBuiltinSearch: false })
  }

  // ── 图片模型 handlers ──
  function handleSaveImage() {
    if (!imageForm.apiKey || !imageForm.model) return
    setImageConfig({ model: imageForm.model, apiKey: imageForm.apiKey, baseURL: imageForm.baseURL || undefined })
    setEditingImage(false)
  }

  // ── 搜索模型 handlers ──
  function handleSaveSearch() {
    if (!searchForm.apiKey || !searchForm.provider) return
    setSearchConfig({ provider: searchForm.provider, apiKey: searchForm.apiKey, baseURL: searchForm.baseURL || undefined })
    setEditingSearch(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden">
        <Tabs orientation="vertical" defaultValue="llm" className="flex h-full min-h-[420px]">
          {/* Left tab list */}
          <div className="flex flex-col w-36 border-r border-border bg-muted/30 p-2 gap-0.5 shrink-0">
            <div className="px-2 pt-2 pb-3">
              <DialogTitle className="text-sm font-semibold">模型配置</DialogTitle>
            </div>
            <TabsList
              variant="line"
              className="flex flex-col w-full bg-transparent p-0 h-auto gap-0.5"
            >
              <TabsTrigger value="llm" className="w-full justify-start gap-2 px-2 py-2 text-sm rounded-md">
                <Bot size={15} />
                通用模型
              </TabsTrigger>
              <TabsTrigger value="image" className="w-full justify-start gap-2 px-2 py-2 text-sm rounded-md">
                <Image size={15} />
                图片模型
              </TabsTrigger>
              <TabsTrigger value="search" className="w-full justify-start gap-2 px-2 py-2 text-sm rounded-md">
                <Search size={15} />
                搜索模型
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Right content */}
          <div className="flex-1 min-w-0 overflow-y-auto">
            {/* ── 通用模型 ── */}
            <TabsContent value="llm" className="p-4 space-y-3 mt-0">
              <div className="text-sm font-medium text-muted-foreground pb-1">通用语言模型配置</div>

              {/* Config list */}
              <div className="space-y-2">
                {configs.map((cfg) => (
                  <div key={cfg.id} className="flex items-center gap-2 p-3 rounded-lg border border-border">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-sm">{cfg.name}</span>
                        {cfg.id === defaultConfigId && (
                          <Badge variant="secondary" className="text-xs px-1.5 py-0">默认</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        {cfg.provider} · {cfg.model}
                        {cfg.enableBuiltinSearch && <Globe size={11} className="text-blue-500" />}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setDefault(cfg.id)} disabled={cfg.id === defaultConfigId}>
                      <Check size={14} className={cn(cfg.id === defaultConfigId ? "text-primary" : "opacity-30")} />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => handleEditLLM(cfg)}>
                      <Pencil size={13} />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive" onClick={() => deleteConfig(cfg.id)}>
                      <Trash2 size={13} />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Add / Edit form */}
              {adding ? (
                <div className="space-y-2.5 border border-dashed border-border rounded-lg p-3">
                  <div className="text-xs font-medium text-muted-foreground">{editingId ? "编辑配置" : "添加新配置"}</div>
                  <Input
                    placeholder="配置名称（如：我的 GPT-4）"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  />
                  <Select
                    value={form.provider}
                    onValueChange={(v: string | null) =>
                      setForm((f) => ({
                        ...f,
                        provider: (v ?? "openai") as LLMProvider,
                        model: MODEL_PRESETS[(v ?? "openai")] ?.[0] ?? "",
                      }))
                    }
                  >
                    <SelectTrigger><SelectValue placeholder="选择提供商" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="openai">OpenAI</SelectItem>
                      <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                      <SelectItem value="custom">自定义端点</SelectItem>
                    </SelectContent>
                  </Select>

                  {form.provider === "custom" ? (
                    <Input
                      placeholder="模型名称（如：qwen-max）"
                      value={form.model}
                      onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                    />
                  ) : (
                    <Select
                      value={form.model}
                      onValueChange={(v: string | null) => setForm((f) => ({ ...f, model: v ?? "" }))}
                    >
                      <SelectTrigger><SelectValue placeholder="选择模型" /></SelectTrigger>
                      <SelectContent>
                        {MODEL_PRESETS[form.provider!]?.map((m) => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  <div className="relative">
                    <Input
                      placeholder="API Key"
                      type={showKey ? "text" : "password"}
                      value={form.apiKey}
                      onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                      className="pr-10"
                    />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowKey((v) => !v)}>
                      {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>

                  {(form.provider === "custom" || form.provider === "openai") && (
                    <Input
                      placeholder="自定义 Base URL（可选）"
                      value={form.baseURL}
                      onChange={(e) => setForm((f) => ({ ...f, baseURL: e.target.value }))}
                    />
                  )}

                  <label className="flex items-center gap-2 text-xs cursor-pointer select-none text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={form.enableBuiltinSearch ?? false}
                      onChange={(e) => setForm((f) => ({ ...f, enableBuiltinSearch: e.target.checked }))}
                      className="rounded"
                    />
                    <Globe size={12} />
                    启用模型内置联网搜索
                  </label>

                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveLLM} className="flex-1">保存</Button>
                    {(configs.length > 0 || editingId) && (
                      <Button size="sm" variant="ghost" onClick={cancelAddLLM}>取消</Button>
                    )}
                  </div>
                </div>
              ) : (
                <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => setAdding(true)}>
                  <Plus size={14} />
                  添加配置
                </Button>
              )}
            </TabsContent>

            {/* ── 图片模型 ── */}
            <TabsContent value="image" className="p-4 space-y-3 mt-0">
              <div className="text-sm font-medium text-muted-foreground pb-1">图片生成模型配置</div>

              {!editingImage && imageConfig ? (
                <div className="flex items-center gap-2 p-3 rounded-lg border border-border">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{imageConfig.model}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{imageConfig.baseURL ?? "默认端点"}</div>
                  </div>
                  <Button variant="ghost" size="sm" className="text-xs" onClick={() => {
                    setImageForm({ model: imageConfig.model, apiKey: imageConfig.apiKey, baseURL: imageConfig.baseURL ?? "" })
                    setEditingImage(true)
                  }}>
                    编辑
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => {
                    setImageConfig(null)
                    setEditingImage(true)
                    setImageForm({ model: "", apiKey: "", baseURL: "" })
                  }}>
                    <Trash2 size={13} />
                  </Button>
                </div>
              ) : (
                <div className="space-y-2.5 border border-dashed border-border rounded-lg p-3">
                  <Input
                    placeholder="模型名称（如：dall-e-3、wanx-v1）"
                    value={imageForm.model}
                    onChange={(e) => setImageForm((f) => ({ ...f, model: e.target.value }))}
                  />
                  <div className="relative">
                    <Input
                      placeholder="API Key"
                      type={showImageKey ? "text" : "password"}
                      value={imageForm.apiKey}
                      onChange={(e) => setImageForm((f) => ({ ...f, apiKey: e.target.value }))}
                      className="pr-10"
                    />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowImageKey((v) => !v)}>
                      {showImageKey ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <Input
                    placeholder="接口地址（Base URL 或完整路径，可选）"
                    value={imageForm.baseURL}
                    onChange={(e) => setImageForm((f) => ({ ...f, baseURL: e.target.value }))}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveImage} className="flex-1">保存</Button>
                    {imageConfig && (
                      <Button size="sm" variant="ghost" onClick={() => setEditingImage(false)}>取消</Button>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* ── 搜索模型 ── */}
            <TabsContent value="search" className="p-4 space-y-3 mt-0">
              <div className="text-sm font-medium text-muted-foreground pb-1">搜索引擎配置（模型不支持联网时使用）</div>

              {!editingSearch && searchConfig ? (
                <div className="flex items-center gap-2 p-3 rounded-lg border border-border">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{searchConfig.provider}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{searchConfig.baseURL ?? "默认端点"}</div>
                  </div>
                  <Button variant="ghost" size="sm" className="text-xs" onClick={() => {
                    setSearchForm({ provider: searchConfig.provider, apiKey: searchConfig.apiKey, baseURL: searchConfig.baseURL ?? "" })
                    setEditingSearch(true)
                  }}>
                    编辑
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => {
                    setSearchConfig(null)
                    setEditingSearch(true)
                    setSearchForm({ provider: "", apiKey: "", baseURL: "" })
                  }}>
                    <Trash2 size={13} />
                  </Button>
                </div>
              ) : (
                <div className="space-y-2.5 border border-dashed border-border rounded-lg p-3">
                  <Input
                    placeholder="搜索提供商（如：serper、tavily）"
                    value={searchForm.provider}
                    onChange={(e) => setSearchForm((f) => ({ ...f, provider: e.target.value }))}
                  />
                  <div className="text-xs text-muted-foreground px-0.5">
                    常用：serper.dev（2500次/月免费）、tavily.com（1000次/月免费）
                  </div>
                  <div className="relative">
                    <Input
                      placeholder="API Key"
                      type={showSearchKey ? "text" : "password"}
                      value={searchForm.apiKey}
                      onChange={(e) => setSearchForm((f) => ({ ...f, apiKey: e.target.value }))}
                      className="pr-10"
                    />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowSearchKey((v) => !v)}>
                      {showSearchKey ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <Input
                    placeholder="自定义接口地址（可选）"
                    value={searchForm.baseURL ?? ""}
                    onChange={(e) => setSearchForm((f) => ({ ...f, baseURL: e.target.value }))}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveSearch} className="flex-1">保存</Button>
                    {searchConfig && (
                      <Button size="sm" variant="ghost" onClick={() => setEditingSearch(false)}>取消</Button>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
