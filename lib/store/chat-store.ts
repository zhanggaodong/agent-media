"use client"

import { create } from "zustand"
import { nanoid } from "nanoid"
import type { Conversation, Message, ToolCall } from "@/types"

interface ChatStore {
  conversations: Conversation[]
  activeConversationId: string | null

  // Computed
  getActiveConversation: () => Conversation | null

  // Conversation actions
  createConversation: (skillId: string, title?: string, firstMessage?: string) => string
  deleteConversation: (id: string) => void
  setActiveConversation: (id: string | null) => void
  updateConversationTitle: (id: string, title: string) => void
  clearPendingFirstMessage: (id: string) => void

  // Message actions
  addMessage: (conversationId: string, message: Omit<Message, "id" | "createdAt">) => string
  updateMessage: (conversationId: string, messageId: string, patch: Partial<Message>) => void
  appendMessageContent: (conversationId: string, messageId: string, delta: string) => void

  // Tool call actions
  addToolCall: (conversationId: string, messageId: string, toolCall: ToolCall) => void
  updateToolCall: (
    conversationId: string,
    messageId: string,
    toolCallId: string,
    patch: Partial<ToolCall>
  ) => void
}

export const useChatStore = create<ChatStore>()((set, get) => ({
  conversations: [],
  activeConversationId: null,

  getActiveConversation: () => {
    const { conversations, activeConversationId } = get()
    return conversations.find((c) => c.id === activeConversationId) ?? null
  },

  createConversation: (skillId, title, firstMessage) => {
    const id = nanoid()
    const now = Date.now()
    const conversation: Conversation = {
      id,
      title: title ?? "新对话",
      skillId,
      messages: [],
      createdAt: now,
      updatedAt: now,
      ...(firstMessage ? { pendingFirstMessage: firstMessage } : {}),
    }
    set((s) => ({
      conversations: [conversation, ...s.conversations],
      activeConversationId: id,
    }))
    return id
  },

  deleteConversation: (id) => {
    set((s) => {
      const conversations = s.conversations.filter((c) => c.id !== id)
      const activeConversationId =
        s.activeConversationId === id
          ? (conversations[0]?.id ?? null)
          : s.activeConversationId
      return { conversations, activeConversationId }
    })
  },

  setActiveConversation: (id) => set({ activeConversationId: id }),

  updateConversationTitle: (id, title) => {
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === id ? { ...c, title, updatedAt: Date.now() } : c
      ),
    }))
  },

  clearPendingFirstMessage: (id) => {
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === id ? { ...c, pendingFirstMessage: undefined } : c
      ),
    }))
  },

  addMessage: (conversationId, message) => {
    const id = nanoid()
    const newMessage: Message = { ...message, id, createdAt: Date.now() }
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === conversationId
          ? { ...c, messages: [...c.messages, newMessage], updatedAt: Date.now() }
          : c
      ),
    }))
    return id
  },

  updateMessage: (conversationId, messageId, patch) => {
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === conversationId
          ? {
              ...c,
              messages: c.messages.map((m) => (m.id === messageId ? { ...m, ...patch } : m)),
              updatedAt: Date.now(),
            }
          : c
      ),
    }))
  },

  appendMessageContent: (conversationId, messageId, delta) => {
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === conversationId
          ? {
              ...c,
              messages: c.messages.map((m) =>
                m.id === messageId ? { ...m, content: m.content + delta } : m
              ),
            }
          : c
      ),
    }))
  },

  addToolCall: (conversationId, messageId, toolCall) => {
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === conversationId
          ? {
              ...c,
              messages: c.messages.map((m) =>
                m.id === messageId
                  ? { ...m, toolCalls: [...(m.toolCalls ?? []), toolCall] }
                  : m
              ),
            }
          : c
      ),
    }))
  },

  updateToolCall: (conversationId, messageId, toolCallId, patch) => {
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === conversationId
          ? {
              ...c,
              messages: c.messages.map((m) =>
                m.id === messageId
                  ? {
                      ...m,
                      toolCalls: m.toolCalls?.map((t) =>
                        t.id === toolCallId ? { ...t, ...patch } : t
                      ),
                    }
                  : m
              ),
            }
          : c
      ),
    }))
  },
}))
