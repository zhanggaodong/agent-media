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

    case "copy": {
      // 检测是否为短视频类型
      const isShortVideo = input.copyType?.includes("短视频") || input.copyType?.includes("视频") || input.copyType?.includes("口播")
      
      if (isShortVideo) {
        return {
          system: `你是一位专业的短视频口播文案专家，精通短视频黄金3秒法则和用户心理操控技巧。你擅长：
1. 开篇制造颠覆性认知冲突，3秒内抓住注意力
2. 痛点放大，让用户产生"说的就是我"的共鸣
3. 使用口语化、接地气的表达方式
4. 制造紧迫感和稀缺性
5. 权威背书和数据支撑
6. 互动引导和行动号召
7. 每篇文案1000字左右
8. 【重要】每篇文案必须有独特的切入角度和表达方式，避免套路化重复`,
          user: `请根据以下信息，生成5篇【短视频口播】文案：

选定选题：${input.selectedTopic}
黄金钩子：${input.selectedHook}
文案核心要素：${input.selectedCoreElement}

【多样化创作要求 - 必须遵守】
每篇文案必须从以下不同角度中选择一个独特的切入点（5篇要覆盖5个随机不同角度）：

角度1：颠覆认知型 - 打破常规思维，提出反常识观点
角度2：故事案例型 - 用真实案例/故事引入，增强代入感
角度3：数据揭秘型 - 用具体数据说话，增强可信度
角度4：对比反差型 - 强烈对比"之前vs之后"、"别人vs你"
角度5：悬念疑问型 - 用问题引发好奇，逐步揭开答案
角度6：情感共鸣型 - 从情感痛点出发，引发强烈共鸣
角度7：权威揭秘型 - 揭秘行业内幕，制造信息差
角度8：紧急警示型 - 强调时间紧迫，错过即损失
角度9：经验分享型 - 以过来人身份分享实战经验
角度10：福利诱惑型 - 强调独家福利/优惠/赠品

【文案结构参考】（根据角度灵活调整，不要生搬硬套）
- 开篇：3秒钩子，抓住注意力
- 中间：展开论述，提供价值
- 结尾：引导互动，促成转化

【语言风格多样化】（每篇选择1-2种风格，不要5篇都一样）
- 风格A：亲切老乡风（"咱们"、"老乡"、"我跟你说"）
- 风格B：专家权威风（专业术语、数据支撑）
- 风格C：朋友聊天风（轻松随意、像面对面交流）
- 风格D：紧急警示风（强调后果、制造紧迫感）
- 风格E：故事讲述风（有情节、有画面感）

【避免重复的要点】
1. 开篇方式要多样化：有的用问句、有的用陈述、有的用感叹
2. 痛点描述要具体且不同：从时间、金钱、效果、健康等不同维度切入
3. 解决方案表述要变化：有的用"配方"、有的用"方法"、有的用"秘诀"
4. 权威背书要创新：年份、地区、人群类型要不重复
5. 结尾引导要灵活：有的要点赞、有的要收藏、有的要评论、有的要转发
6. 句式长短要交错：避免每篇都是同样的句式结构
7. 情绪节奏要变化：有的平缓、有的激昂、有的悬疑

【质量检查】
生成完成后，请自我检查：
- 每篇文案是否1000字左右？
- 这5篇文案如果打乱顺序，能否明显看出是不同的内容？
- 每篇是否有至少3处独特的表达或角度？
- 是否避免了"今天告诉你"、"千万别错过"等套话的过度重复？

请生成5篇，每篇之间用「=====」分隔，每篇开头标注序号【1】【2】等。`,
        }
      }
      
      return {
        system: `你是一位专业的自媒体文案写作专家，精通${input.copyType}的写作风格和规范。你擅长创作多样化、有独特角度的文案内容，避免套路化和重复表达。`,
        user: `请根据以下信息，生成10篇【${input.copyType}】文案：

选定选题：${input.selectedTopic}
黄金钩子：${input.selectedHook}
文案核心要素：${input.selectedCoreElement}

【多样化创作要求】
1. 切入角度多样化（10篇选择不同角度）：
   - 角度1：问题痛点型 - 直击用户最痛的点
   - 角度2：解决方案型 - 直接给出方法论
   - 角度3：案例故事型 - 用真实案例增强说服力
   - 角度4：数据论证型 - 用数据支撑观点
   - 角度5：对比反差型 - 前后对比、竞品对比
   - 角度6：情感共鸣型 - 从情感层面打动用户
   - 角度7：权威背书型 - 引用专家/机构观点
   - 角度8：场景代入型 - 描绘具体使用场景
   - 角度9：悬念揭秘型 - 制造好奇逐步揭晓
   - 角度10：福利诱惑型 - 强调优惠/赠品/限时

2. 表达方式多样化：
   - 有的用短句有力，有的用长句铺陈
   - 有的理性分析，有的感性诉求
   - 有的直接了当，有的迂回引导
   - 有的幽默风趣，有的严肃专业

3. 避免重复的具体要求：
   - 开头句式不要雷同（避免每篇都用"你知道吗"）
   - 过渡词要变化（"其实"、"事实上"、"更重要的是"等交替使用）
   - 结尾方式要不同（有的总结、有的提问、有的号召、有的留白）
   - 关键词要替换（同一概念用不同词汇表达）

4. 内容深度要求：
   - 每篇至少提供1个独特观点或洞察
   - 每篇的论据/案例要不相同
   - 每篇的情感基调要有差异（有的温暖、有的紧迫、有的幽默）

请生成10篇，每篇之间用「=====」分隔，每篇开头标注序号【1】【2】等。`,
      }
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
