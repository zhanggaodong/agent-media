// ============================================================
// Core Types
// ============================================================

export type Role = "user" | "assistant" | "tool"

export type MessageStatus = "pending" | "streaming" | "done" | "error"

export interface ToolCall {
  id: string
  name: string
  input: Record<string, unknown>
  status: "pending" | "running" | "done" | "error"
  output?: unknown
  startedAt?: number
  endedAt?: number
}

export interface Message {
  id: string
  role: Role
  content: string
  toolCalls?: ToolCall[]
  status: MessageStatus
  createdAt: number
}

export interface Conversation {
  id: string
  title: string
  skillId: string
  messages: Message[]
  createdAt: number
  updatedAt: number
  pendingFirstMessage?: string
}

// ============================================================
// Skills
// ============================================================

export interface FormField {
  key: string
  label: string
  type: "text" | "textarea" | "select"
  placeholder?: string
  options?: { label: string; value: string }[]
  required?: boolean
}

export interface Skill {
  id: string
  name: string
  description: string
  icon: string
  systemPrompt: string
  tools: string[]
  inputForm?: FormField[]
  category: "writing" | "image" | "code" | "search" | "general"
}

// ============================================================
// LLM Configuration
// ============================================================

export type LLMProvider = "openai" | "anthropic" | "custom"

export interface LLMConfig {
  id: string
  name: string
  provider: LLMProvider
  model: string
  apiKey: string
  baseURL?: string
  isDefault?: boolean
  enableBuiltinSearch?: boolean
}

export interface ImageModelConfig {
  model: string
  apiKey: string
  baseURL?: string
}

export type SearchProvider = string

export interface SearchConfig {
  provider: SearchProvider
  apiKey: string
  baseURL?: string
}

// ============================================================
// SSE Event Types (Frontend ↔ Backend protocol)
// ============================================================

export type SSEEventType =
  | "text_delta"
  | "tool_start"
  | "tool_result"
  | "error"
  | "done"

export interface SSEEvent {
  type: SSEEventType
  data: unknown
}

export interface TextDeltaData {
  delta: string
}

export interface ToolStartData {
  toolCallId: string
  toolName: string
  input: Record<string, unknown>
}

export interface ToolResultData {
  toolCallId: string
  toolName: string
  output: unknown
  isError?: boolean
}
