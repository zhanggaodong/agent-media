"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { nanoid } from "nanoid"

export interface CopywritingProject {
  id: string
  title: string
  createdAt: number
  updatedAt: number

  // Step 1: Basic input
  industry: string
  ipPositioning: string
  initialIdea: string
  topicType: string

  // Step 2: Topics
  generatedTopics: string[]
  selectedTopicIndex: number | null

  // Step 3: Hooks
  hookType: string
  generatedHooks: string[]
  selectedHookIndex: number | null

  // Step 4: Core elements
  generatedCoreElements: string[]
  selectedCoreElementIndex: number | null

  // Step 5: Final copy
  copyType: string
  generatedCopies: string[]
  selectedCopyIndex: number | null
}

interface CopywritingWorkflowStore {
  projects: CopywritingProject[]
  activeProjectId: string | null

  getActiveProject: () => CopywritingProject | null
  createProject: () => string
  deleteProject: (id: string) => void
  setActiveProject: (id: string | null) => void
  updateProject: (id: string, patch: Partial<CopywritingProject>) => void
}

function emptyProject(id: string): CopywritingProject {
  const now = Date.now()
  return {
    id,
    title: "新文案项目",
    createdAt: now,
    updatedAt: now,
    industry: "",
    ipPositioning: "",
    initialIdea: "",
    topicType: "",
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
  }
}

export const useCopywritingWorkflowStore = create<CopywritingWorkflowStore>()(
  persist(
    (set, get) => ({
      projects: [],
      activeProjectId: null,

      getActiveProject: () => {
        const { projects, activeProjectId } = get()
        return projects.find((p) => p.id === activeProjectId) ?? null
      },

      createProject: () => {
        const id = nanoid()
        const project = emptyProject(id)
        set((s) => ({
          projects: [project, ...s.projects],
          activeProjectId: id,
        }))
        return id
      },

      deleteProject: (id) => {
        set((s) => {
          const projects = s.projects.filter((p) => p.id !== id)
          const activeProjectId =
            s.activeProjectId === id ? (projects[0]?.id ?? null) : s.activeProjectId
          return { projects, activeProjectId }
        })
      },

      setActiveProject: (id) => set({ activeProjectId: id }),

      updateProject: (id, patch) => {
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p
          ),
        }))
      },
    }),
    { name: "copywriting-workflow" }
  )
)
