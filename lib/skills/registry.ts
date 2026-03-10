import type { Skill } from "@/types"

export const SKILLS: Skill[] = [
  {
    id: "xiaohongshu",
    name: "小红书创作",
    description: "生成小红书爆款文案 + AI 配图，一键生成完整笔记",
    icon: "📖",
    category: "writing",
    systemPrompt: `你是一位专业的小红书内容创作专家。
你的任务是根据用户需求，创作高质量的小红书笔记内容，包括：
1. 吸引眼球的标题（带emoji，控制在20字内）
2. 有价值的正文内容（分段清晰，多用emoji，800-1200字）
3. 相关话题标签（10-15个）
4. 为笔记生成配图（调用图片生成工具）

创作风格：真实、有共鸣、实用、生活化。`,
    tools: ["web_search", "generate_image"],
  },
  {
    id: "web_research",
    name: "网络调研",
    description: "自动搜索、整理、总结指定主题的网络信息",
    icon: "🔍",
    category: "search",
    systemPrompt: `你是一位专业的信息调研专家。
根据用户的调研需求，你会：
1. 分析调研方向，拆解搜索关键词
2. 多次调用搜索工具获取信息
3. 整合信息，去除重复内容
4. 输出结构清晰的调研报告（包含来源）`,
    tools: ["web_search"],
  },
  {
    id: "general",
    name: "通用助手",
    description: "自由对话，可调用搜索、图片生成等工具",
    icon: "🤖",
    category: "general",
    systemPrompt: `你是一个强大的 AI 助手，可以帮助用户完成各种任务。
你可以使用以下工具：
- web_search：搜索实时信息
- generate_image：生成图片

根据用户需求灵活使用工具，给出最优质的回答。`,
    tools: ["web_search", "generate_image"],
  },
]

export function getSkillById(id: string): Skill | undefined {
  return SKILLS.find((s) => s.id === id)
}
