"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { nanoid } from "nanoid"

export interface DropdownOption {
  id: string
  label: string
}

const DEFAULT_TOPIC_TYPES: DropdownOption[] = [
  { id: "tt1", label: "知识科普" },
  { id: "tt2", label: "情感共鸣" },
  { id: "tt3", label: "产品测评" },
  { id: "tt4", label: "干货分享" },
  { id: "tt5", label: "故事叙述" },
  { id: "tt6", label: "热点借势" },
  { id: "tt7", label: "话题讨论" },
  { id: "tt8", label: "经验分享" },
  { id: "tt9", label: "对比分析" },
  { id: "tt10", label: "趋势预测" },
]

const DEFAULT_HOOK_TYPES: DropdownOption[] = [
  { id: "ht1", label: "悬念型" },
  { id: "ht2", label: "痛点型" },
  { id: "ht3", label: "福利型" },
  { id: "ht4", label: "好奇型" },
  { id: "ht5", label: "反常识型" },
  { id: "ht6", label: "数字型" },
  { id: "ht7", label: "故事型" },
  { id: "ht8", label: "争议型" },
  { id: "ht9", label: "场景代入型" },
  { id: "ht10", label: "权威背书型" },
]

const DEFAULT_COPY_TYPES: DropdownOption[] = [
  { id: "ct1", label: "小红书风格" },
  { id: "ct2", label: "微信公众号文章" },
  { id: "ct3", label: "抖音短视频脚本" },
  { id: "ct4", label: "微博文案" },
  { id: "ct5", label: "知乎回答" },
  { id: "ct6", label: "B站视频简介" },
  { id: "ct7", label: "朋友圈文案" },
  { id: "ct8", label: "头条号文章" },
]

type OptionType = "topicTypes" | "hookTypes" | "copyTypes"

interface CopywritingConfigStore {
  topicTypes: DropdownOption[]
  hookTypes: DropdownOption[]
  copyTypes: DropdownOption[]
  addOption: (type: OptionType, label: string) => void
  updateOption: (type: OptionType, id: string, label: string) => void
  deleteOption: (type: OptionType, id: string) => void
}

export const useCopywritingConfigStore = create<CopywritingConfigStore>()(
  persist(
    (set) => ({
      topicTypes: DEFAULT_TOPIC_TYPES,
      hookTypes: DEFAULT_HOOK_TYPES,
      copyTypes: DEFAULT_COPY_TYPES,

      addOption: (type, label) => {
        set((s) => ({ [type]: [...s[type], { id: nanoid(), label }] }))
      },

      updateOption: (type, id, label) => {
        set((s) => ({
          [type]: s[type].map((o) => (o.id === id ? { ...o, label } : o)),
        }))
      },

      deleteOption: (type, id) => {
        set((s) => ({ [type]: s[type].filter((o) => o.id !== id) }))
      },
    }),
    { name: "copywriting-config" }
  )
)
