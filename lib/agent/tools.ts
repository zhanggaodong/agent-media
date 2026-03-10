// Tool definitions and implementations

export interface ToolDefinition {
  name: string
  description: string
  parameters: {
    type: "object"
    properties: Record<string, { type: string; description: string }>
    required?: string[]
  }
}

export const TOOL_DEFINITIONS: Record<string, ToolDefinition> = {
  web_search: {
    name: "web_search",
    description: "Search the web for real-time information",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "The search query" },
      },
      required: ["query"],
    },
  },
  generate_image: {
    name: "generate_image",
    description: "Generate an image based on a text description",
    parameters: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "Detailed description of the image to generate",
        },
        size: {
          type: "string",
          description: "Image size, e.g. 2560x1440",
        },
      },
      required: ["prompt"],
    },
  },
}

export interface ImageConfig {
  model?: string
  apiKey: string
  baseURL?: string
}

export interface SearchConfig {
  provider: string
  apiKey: string
  baseURL?: string
}

// Tool executor
export async function executeTool(
  toolName: string,
  input: Record<string, unknown>,
  apiKey: string,
  baseURL?: string,
  imageConfig?: ImageConfig,
  searchConfig?: SearchConfig
): Promise<unknown> {
  switch (toolName) {
    case "web_search":
      return executeWebSearch(input.query as string, searchConfig)
    case "generate_image":
      return executeGenerateImage(
        input.prompt as string,
        (input.size as string) ?? "2560x1440",
        imageConfig ?? { apiKey, baseURL }
      )
    default:
      throw new Error(`Unknown tool: ${toolName}`)
  }
}

async function executeWebSearch(query: string, searchConfig?: SearchConfig): Promise<unknown> {
  if (searchConfig?.provider === "serper") {
    return executeSerperSearch(query, searchConfig.apiKey)
  }
  if (searchConfig?.provider === "tavily") {
    return executeTavilySearch(query, searchConfig.apiKey)
  }
  // Fallback: DuckDuckGo instant answer (no key required, limited results)
  return executeDuckDuckGoSearch(query)
}

async function executeSerperSearch(query: string, apiKey: string): Promise<unknown> {
  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ q: query, num: 8, hl: "zh-cn" }),
    })
    const data = await res.json()
    if (data.error) throw new Error(data.error)
    const results = (data.organic ?? []).slice(0, 8).map((r: { title?: string; snippet?: string; link?: string }) => ({
      title: r.title ?? "",
      snippet: r.snippet ?? "",
      url: r.link ?? "",
    }))
    const knowledgeGraph = data.knowledgeGraph
      ? { title: data.knowledgeGraph.title, description: data.knowledgeGraph.description }
      : undefined
    return { query, results, ...(knowledgeGraph && { knowledgeGraph }) }
  } catch (e) {
    return { query, error: String(e), results: [] }
  }
}

async function executeTavilySearch(query: string, apiKey: string): Promise<unknown> {
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, max_results: 8, include_answer: true }),
    })
    const data = await res.json()
    if (data.error) throw new Error(data.error)
    const results = (data.results ?? []).map((r: { title?: string; content?: string; url?: string }) => ({
      title: r.title ?? "",
      snippet: r.content ?? "",
      url: r.url ?? "",
    }))
    return { query, answer: data.answer ?? "", results }
  } catch (e) {
    return { query, error: String(e), results: [] }
  }
}

async function executeDuckDuckGoSearch(query: string): Promise<unknown> {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1`
  try {
    const res = await fetch(url, { headers: { "User-Agent": "AgentPlatform/1.0" } })
    const data = await res.json()
    return {
      query,
      abstract: data.Abstract ?? "",
      abstractSource: data.AbstractSource ?? "",
      abstractURL: data.AbstractURL ?? "",
      relatedTopics: (data.RelatedTopics ?? []).slice(0, 5).map((t: { Text?: string; FirstURL?: string }) => ({
        text: t.Text ?? "",
        url: t.FirstURL ?? "",
      })),
    }
  } catch {
    return { query, error: "Search failed", results: [] }
  }
}

async function executeGenerateImage(
  prompt: string,
  size: string,
  imageConfig: ImageConfig
): Promise<unknown> {
  const { apiKey, baseURL, model = "dall-e-3" } = imageConfig

  // If baseURL already looks like a full endpoint (contains "images/generat"), use it directly.
  // Otherwise treat it as a base URL and append the standard path.
  let endpoint: string
  if (!baseURL) {
    endpoint = "https://api.openai.com/v1/images/generations"
  } else if (baseURL.includes("images/generat")) {
    endpoint = baseURL.replace(/\/$/, "")
  } else {
    endpoint = `${baseURL.replace(/\/$/, "")}/images/generations`
  }

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt,
        n: 1,
        size: size || "2560x1440",
      }),
    })
    const rawText = await res.text()
    if (!res.ok) {
      return { error: `HTTP ${res.status}: ${rawText}` }
    }
    const data = JSON.parse(rawText)
    if (data.error) {
      const msg = typeof data.error === "string" ? data.error : (data.error.message ?? JSON.stringify(data.error))
      return { error: msg }
    }
    return { url: data.data?.[0]?.url, revisedPrompt: data.data?.[0]?.revised_prompt }
  } catch (e) {
    return { error: String(e) }
  }
}
