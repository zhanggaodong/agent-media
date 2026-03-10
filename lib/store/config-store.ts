"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { LLMConfig, ImageModelConfig, SearchConfig } from "@/types"
import { nanoid } from "nanoid"

interface ConfigStore {
  configs: LLMConfig[]
  defaultConfigId: string | null
  imageConfig: ImageModelConfig | null
  searchConfig: SearchConfig | null
  // Actions
  addConfig: (config: Omit<LLMConfig, "id">) => void
  updateConfig: (id: string, patch: Partial<LLMConfig>) => void
  deleteConfig: (id: string) => void
  setDefault: (id: string) => void
  getDefaultConfig: () => LLMConfig | null
  setImageConfig: (config: ImageModelConfig | null) => void
  setSearchConfig: (config: SearchConfig | null) => void
}

export const useConfigStore = create<ConfigStore>()(
  persist(
    (set, get) => ({
      configs: [],
      defaultConfigId: null,
      imageConfig: null,
      searchConfig: null,

      addConfig: (config) => {
        const newConfig: LLMConfig = { ...config, id: nanoid() }
        set((s) => ({
          configs: [...s.configs, newConfig],
          defaultConfigId: s.defaultConfigId ?? newConfig.id,
        }))
      },

      updateConfig: (id, patch) => {
        set((s) => ({
          configs: s.configs.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        }))
      },

      deleteConfig: (id) => {
        set((s) => {
          const configs = s.configs.filter((c) => c.id !== id)
          const defaultConfigId =
            s.defaultConfigId === id ? (configs[0]?.id ?? null) : s.defaultConfigId
          return { configs, defaultConfigId }
        })
      },

      setDefault: (id) => set({ defaultConfigId: id }),

      setImageConfig: (config) => set({ imageConfig: config }),

      setSearchConfig: (config) => set({ searchConfig: config }),

      getDefaultConfig: () => {
        const { configs, defaultConfigId } = get()
        return configs.find((c) => c.id === defaultConfigId) ?? configs[0] ?? null
      },
    }),
    { name: "agent-llm-config" }
  )
)
