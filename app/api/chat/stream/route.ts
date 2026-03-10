import { NextRequest } from "next/server"
import { TOOL_DEFINITIONS, executeTool } from "@/lib/agent/tools"
import { getSkillById } from "@/lib/skills/registry"
import type { LLMConfig, ImageModelConfig, SearchConfig } from "@/types"

export const runtime = "nodejs"
export const maxDuration = 120

// ── OpenAI-compatible message types ──────────────────────────────────────────

interface SystemMessage {
  role: "system"
  content: string
}

interface UserMessage {
  role: "user"
  content: string
}

interface AssistantMessage {
  role: "assistant"
  content: string | null
  tool_calls?: OAIToolCall[]
}

interface ToolResultMessage {
  role: "tool"
  tool_call_id: string
  content: string
}

interface OAIToolCall {
  id: string
  type: "function"
  function: {
    name: string
    arguments: string // JSON string
  }
}

type ConversationMessage =
  | SystemMessage
  | UserMessage
  | AssistantMessage
  | ToolResultMessage

// ── Incoming request body uses simpler format ─────────────────────────────────

interface IncomingMessage {
  role: "user" | "assistant" | "tool"
  content: string
}

// ── SSE helper ────────────────────────────────────────────────────────────────

function sendEvent(
  controller: ReadableStreamDefaultController,
  type: string,
  data: unknown
) {
  const line = `data: ${JSON.stringify({ type, data })}\n\n`
  controller.enqueue(new TextEncoder().encode(line))
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { messages, skillId, config, imageConfig, searchConfig } = body as {
    messages: IncomingMessage[]
    skillId: string
    config: LLMConfig
    imageConfig?: ImageModelConfig
    searchConfig?: SearchConfig
  }

  const skill = getSkillById(skillId)
  if (!skill) {
    return new Response(JSON.stringify({ error: "Skill not found" }), { status: 400 })
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        await runAgentLoop(controller, messages, skill, config, imageConfig, searchConfig)
      } catch (e) {
        sendEvent(controller, "error", { message: String(e) })
      } finally {
        sendEvent(controller, "done", {})
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}

// ── Agent loop ────────────────────────────────────────────────────────────────

async function runAgentLoop(
  controller: ReadableStreamDefaultController,
  incomingMessages: IncomingMessage[],
  skill: NonNullable<ReturnType<typeof getSkillById>>,
  config: LLMConfig,
  imageConfig?: ImageModelConfig,
  searchConfig?: SearchConfig
) {
  // Build OpenAI-compatible tool definitions
  // When using built-in search, exclude web_search so model uses its own search capability
  const toolNames = config.enableBuiltinSearch
    ? skill.tools.filter((name) => name !== "web_search")
    : skill.tools
  const tools = toolNames
    .filter((name) => TOOL_DEFINITIONS[name])
    .map((name) => {
      const def = TOOL_DEFINITIONS[name]
      return {
        type: "function" as const,
        function: {
          name: def.name,
          description: def.description,
          parameters: def.parameters,
        },
      }
    })

  // Initialise conversation history
  const currentDate = new Date().toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  })
  const searchNote = config.enableBuiltinSearch
    ? "\n\n注意：联网搜索已由系统自动处理，请直接回答用户问题，无需手动调用 web_search 工具。"
    : ""
  const history: ConversationMessage[] = [
    { role: "system", content: `当前日期：${currentDate}\n\n${skill.systemPrompt}${searchNote}` },
    ...incomingMessages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ]

  // Agent loop – max 10 rounds to prevent runaway loops
  for (let round = 0; round < 10; round++) {
    const response = await fetch(getEndpoint(config), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        messages: history,
        ...(tools.length > 0 && { tools, tool_choice: "auto" }),
        ...(config.enableBuiltinSearch && { enable_search: true }),
        stream: true,
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`LLM API error ${response.status}: ${err}`)
    }

    const { toolCalls, text, finishReason } = await parseStream(controller, response)

    // Only execute tool calls when the model explicitly requests it (finish_reason === "tool_calls").
    // When enable_search is active, Qwen may emit web_search tool_call deltas as part of its
    // internal search stream, but finish_reason will be "stop" – we must not execute those.
    if (toolCalls.length === 0 || finishReason !== "tool_calls") {
      break
    }

    // Append assistant turn with tool_calls (OpenAI format)
    history.push({
      role: "assistant",
      content: text || null,
      tool_calls: toolCalls.map((tc) => ({
        id: tc.id,
        type: "function",
        function: {
          name: tc.name,
          arguments: JSON.stringify(tc.input),
        },
      })),
    })

    // Execute each tool, push result back into history
    for (const tc of toolCalls) {
      sendEvent(controller, "tool_start", {
        toolCallId: tc.id,
        toolName: tc.name,
        input: tc.input,
      })

      let output: unknown
      let isError = false
      try {
        output = await executeTool(tc.name, tc.input, config.apiKey, config.baseURL, imageConfig, searchConfig)
      } catch (e) {
        output = { error: String(e) }
        isError = true
      }

      sendEvent(controller, "tool_result", {
        toolCallId: tc.id,
        toolName: tc.name,
        output,
        isError,
      })

      history.push({
        role: "tool",
        tool_call_id: tc.id,
        content: JSON.stringify(output),
      })
    }
  }
}

// ── Stream parser ─────────────────────────────────────────────────────────────

interface ParsedToolCall {
  id: string
  name: string
  input: Record<string, unknown>
}

async function parseStream(
  controller: ReadableStreamDefaultController,
  response: Response
): Promise<{ toolCalls: ParsedToolCall[]; text: string; finishReason: string | null }> {
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()

  let fullText = ""
  let buffer = ""
  let finishReason: string | null = null
  // keyed by index (string) to preserve insertion order
  const accumulator: Record<string, { id: string; name: string; args: string }> = {}

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() ?? "" // keep incomplete last line

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue
      const raw = line.slice(6).trim()
      if (raw === "[DONE]") continue

      let chunk: Record<string, unknown>
      try {
        chunk = JSON.parse(raw)
      } catch {
        continue
      }

      const choices = chunk.choices as Array<{
        delta?: {
          content?: string | null
          tool_calls?: Array<{
            index: number
            id?: string
            function?: { name?: string; arguments?: string }
          }>
        }
        finish_reason?: string | null
      }> | undefined

      if (!choices?.[0]) continue

      // Track finish_reason
      if (choices[0].finish_reason) {
        finishReason = choices[0].finish_reason
      }

      const { delta } = choices[0]
      if (!delta) continue

      // Text delta
      if (delta.content) {
        fullText += delta.content
        sendEvent(controller, "text_delta", { delta: delta.content })
      }

      // Tool call delta – accumulate fragments
      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const key = String(tc.index)
          if (!accumulator[key]) {
            accumulator[key] = { id: "", name: "", args: "" }
          }
          if (tc.id) accumulator[key].id = tc.id
          if (tc.function?.name) accumulator[key].name += tc.function.name
          if (tc.function?.arguments) accumulator[key].args += tc.function.arguments
        }
      }
    }
  }

  const toolCalls: ParsedToolCall[] = Object.values(accumulator).map((tc) => ({
    id: tc.id,
    name: tc.name,
    input: (() => {
      try {
        return JSON.parse(tc.args) as Record<string, unknown>
      } catch {
        return {}
      }
    })(),
  }))

  return { toolCalls, text: fullText, finishReason }
}

// ── Endpoint resolver ─────────────────────────────────────────────────────────

function getEndpoint(config: LLMConfig): string {
  if (config.baseURL) {
    const base = config.baseURL.replace(/\/$/, "")
    // If the user already included the full endpoint path, use it as-is
    if (base.endsWith("/chat/completions")) return base
    return `${base}/chat/completions`
  }
  return "https://api.openai.com/v1/chat/completions"
}
