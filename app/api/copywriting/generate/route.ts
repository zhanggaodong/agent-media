import { NextRequest } from "next/server"
import type { LLMConfig } from "@/types"

export const runtime = "nodejs"
export const maxDuration = 120

function getEndpoint(config: LLMConfig): string {
  if (config.baseURL) {
    const base = config.baseURL.replace(/\/$/, "")
    if (base.endsWith("/chat/completions")) return base
    return `${base}/chat/completions`
  }
  return "https://api.openai.com/v1/chat/completions"
}

function buildMessages(
  stage: string,
  input: Record<string, string>
): { system: string; user: string } {
  switch (stage) {
    case "topics":
      return {
        system:
          "你是一位专业的自媒体内容策划专家。请严格以编号列表格式输出，每行一条，格式：1. 内容，共10条。",
        user: `请为以下自媒体账号生成10个【${input.topicType}】类型的选题：

行业/产品：${input.industry}
IP定位：${input.ipPositioning}
初步想法：${input.initialIdea}

要求：每个选题简洁有力，有话题性，适合自媒体传播，不超过30字。
直接输出编号列表，每行一个选题，共10条。`,
      }

    case "hooks":
      return {
        system:
          "你是一位专业的自媒体文案专家，擅长设计引人入胜的开篇钩子。请严格以编号列表格式输出，共10条。",
        user: `请为以下选题生成10个【${input.hookType}】类型的黄金钩子（开篇第一句话）：

选定选题：${input.selectedTopic}

要求：钩子简洁有力（1-2句话），能立即抓住读者注意力，引发好奇或共鸣。
直接输出编号列表，每行一个钩子，共10条。`,
      }

    case "core_elements":
      return {
        system:
          "你是一位专业的自媒体内容策划专家。请以编号列表格式输出10套文案核心要素，每套在同一行，用「|」分隔各部分。",
        user: `请为以下选题和钩子生成10套文案核心要素：

选定选题：${input.selectedTopic}
选定钩子：${input.selectedHook}

每套格式：核心观点：XXX | 主要论据：XXX | 情感诉求：XXX | 行动号召：XXX

直接输出编号列表，每行一套，共10条。`,
      }

    case "copy":
      return {
        system: `你是一位专业的自媒体文案写作专家，精通${input.copyType}的写作风格和规范。`,
        user: `请根据以下信息，生成10篇【${input.copyType}】文案：

选定选题：${input.selectedTopic}
黄金钩子：${input.selectedHook}
文案核心要素：${input.selectedCoreElement}

要求：
1. 开头必须使用选定钩子
2. 围绕核心要素展开内容
3. 符合${input.copyType}的风格、格式和字数要求
4. 内容完整，有吸引力

请生成10篇，每篇之间用「=====」分隔，每篇开头标注序号【1】【2】等。`,
      }

    default:
      throw new Error(`Unknown stage: ${stage}`)
  }
}

// ── Incremental item detection ─────────────────────────────────────────────────
// Returns items that are definitely complete (next item boundary has appeared).

function getCompleteItemsSoFar(text: string, stage: string): string[] {
  if (stage === "copy") {
    const parts = text.split(/={5,}/)
    // All parts except the last are complete (last may still be streaming)
    if (parts.length <= 1) return []
    return parts
      .slice(0, -1)
      .map((p) => p.replace(/^【\d+】\s*\n?/, "").trim())
      .filter((p) => p.length > 5)
  }

  // For numbered lists, find the start index of each "N. " marker
  const boundaries: number[] = []
  for (let n = 1; n <= 11; n++) {
    const re = new RegExp(`(?:^|\\n)${n}[.、）)][\\t ]`)
    const m = re.exec(text)
    if (m) {
      boundaries.push(m.index + (text[m.index] === "\n" ? 1 : 0))
    }
  }

  const items: string[] = []
  // Item i is complete when boundary i+1 has appeared
  for (let i = 0; i < boundaries.length - 1; i++) {
    const chunk = text.slice(boundaries[i], boundaries[i + 1]).trim()
    const content = chunk.replace(/^\d+[.、）)][\t ]*/, "").trim()
    if (content.length > 1) items.push(content)
  }
  return items
}

// Final parse after stream ends — same logic but includes the last item
function parseFinalItems(text: string, stage: string): string[] {
  if (stage === "copy") {
    return text
      .split(/={3,}/)
      .map((p) => p.replace(/^【\d+】\s*\n?/, "").trim())
      .filter((p) => p.length > 10)
      .slice(0, 10)
  }

  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
  const items: string[] = []
  for (const line of lines) {
    const match = line.match(/^\d+[.、）)]\s*(.+)$/)
    if (match) items.push(match[1].trim())
  }
  return items.slice(0, 10)
}

// ── SSE helpers ────────────────────────────────────────────────────────────────

function sendEvent(
  controller: ReadableStreamDefaultController,
  type: string,
  data: unknown
) {
  const line = `data: ${JSON.stringify({ type, data })}\n\n`
  controller.enqueue(new TextEncoder().encode(line))
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { stage, input, config } = body as {
    stage: string
    input: Record<string, string>
    config: LLMConfig
  }

  const { system, user } = buildMessages(stage, input)

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Immediately signal that the request is received and AI is processing.
        // This replaces the silent "pending" state in the browser with visible feedback.
        sendEvent(controller, "thinking", {})

        const endpoint = getEndpoint(config)
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: config.model,
            messages: [
              { role: "system", content: system },
              { role: "user", content: user },
            ],
            stream: true,
            ...(config.enableBuiltinSearch && { enable_search: true }),
          }),
          cache: "no-store",
        })

        if (!response.ok) {
          const err = await response.text()
          sendEvent(controller, "error", {
            message: `API 错误 ${response.status}（${endpoint}）: ${err}`,
          })
          return
        }

        const reader = response.body!.getReader()
        const decoder = new TextDecoder()
        let fullText = ""
        let buffer = ""
        let emittedCount = 0

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() ?? ""

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

            const choices = chunk.choices as
              | Array<{ delta?: { content?: string | null } }>
              | undefined
            const delta = choices?.[0]?.delta?.content
            if (!delta) continue

            fullText += delta

            // Stream raw delta to client for live preview
            sendEvent(controller, "text_delta", { content: delta })

            // Check whether any new complete items have appeared
            const completeNow = getCompleteItemsSoFar(fullText, stage)
            while (emittedCount < completeNow.length) {
              sendEvent(controller, "item", {
                item: completeNow[emittedCount],
                index: emittedCount,
              })
              emittedCount++
            }
          }
        }

        // Emit any remaining items (last item has no following boundary)
        const finalItems = parseFinalItems(fullText, stage)
        while (emittedCount < finalItems.length) {
          sendEvent(controller, "item", {
            item: finalItems[emittedCount],
            index: emittedCount,
          })
          emittedCount++
        }
      } catch (e) {
        const cause = (e as { cause?: unknown })?.cause
        const causeMsg =
          cause instanceof Error ? cause.message : cause != null ? String(cause) : null
        const msg = e instanceof Error ? e.message : String(e)
        sendEvent(controller, "error", {
          message: causeMsg ? `${msg}: ${causeMsg}` : msg,
        })
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
