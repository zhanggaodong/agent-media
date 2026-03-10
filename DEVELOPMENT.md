# Agent Platform 开发文档

## 项目概述

类 Manus 的通用 AI Agent 执行平台。左侧边栏管理对话历史，右侧双栏工作区（对话面板 + 工具执行面板），支持多技能、工具调用可视化、自定义 LLM 配置。

---

## 技术栈

| 层次 | 技术 |
|------|------|
| 框架 | Next.js 16 (App Router, Turbopack) |
| UI | Shadcn/ui + Tailwind CSS |
| 状态管理 | Zustand (with persist middleware) |
| 实时通信 | SSE (Server-Sent Events) |
| 本地存储 | Zustand persist → localStorage |
| 字体 | Geist (Sans + Mono) |

---

## 项目结构

```
agent-platform/
├── app/
│   ├── page.tsx                        # 主页（侧边栏 + 工作区）
│   ├── layout.tsx                      # 根布局 + TooltipProvider
│   ├── globals.css                     # 全局样式（含 shadcn 主题变量）
│   └── api/
│       └── chat/stream/route.ts        # SSE 流式 Agent Loop（核心后端）
├── components/
│   ├── layout/
│   │   └── app-sidebar.tsx             # 侧边栏：历史列表、新建对话、设置入口
│   ├── chat/
│   │   ├── chat-workspace.tsx          # 工作区：双栏布局 + Agent 调用逻辑
│   │   ├── message-list.tsx            # 消息列表 + 工具调用状态气泡
│   │   ├── chat-input.tsx              # 输入框（Enter 发送、停止按钮）
│   │   ├── tool-panel.tsx              # 右栏工具执行可视化（卡片展开/收起）
│   │   ├── skill-input-form.tsx        # 技能引导表单（首次对话前的结构化输入）
│   │   └── welcome-screen.tsx          # 欢迎页（技能卡片选择）
│   └── settings/
│       └── llm-config-dialog.tsx       # LLM 配置弹窗（多配置管理、默认切换）
├── lib/
│   ├── agent/
│   │   └── tools.ts                    # 工具定义（schema）+ 工具执行实现
│   ├── skills/
│   │   └── registry.ts                 # 技能注册表（系统 Prompt、工具列表、表单）
│   ├── store/
│   │   ├── chat-store.ts               # 对话状态（Zustand，内存）
│   │   └── config-store.ts             # LLM 配置状态（Zustand + localStorage 持久化）
│   └── utils.ts                        # cn() + formatDistanceToNow()
└── types/
    └── index.ts                        # 全局类型定义
```

---

## 核心架构

### 关于模型内置能力 vs 工具调用

- **内置联网模型**（如 Qwen）：发送 `web_search` tool 定义后，模型自行决定是用内置搜索还是调用工具。若用内置搜索，工具面板不会有记录，属正常现象，结果不受影响。可在技能配置中把 `web_search` 从 `tools` 列表移除，完全依赖模型内置能力。
- **图片生成**：`generate_image` 工具目前调 DALL-E 3（需 OpenAI Key）。若使用自有图片 API，后续通过"图片生成独立配置"功能解耦（见待办）。

### SSE 通信协议（前后端约定）

后端 `/api/chat/stream` 推送以下事件类型：

```
event type        data 结构
─────────────────────────────────────────────────
text_delta        { delta: string }
tool_start        { toolCallId, toolName, input }
tool_result       { toolCallId, toolName, output, isError }
error             { message: string }
done              {}
```

### Agent Loop 流程

```
用户输入
  → POST /api/chat/stream
  → 构建 messages（system + history + user）
  → 调用 LLM（stream=true）
  → 解析流：text_delta 推送文本 / tool_calls 累积
  → 有工具调用？
      是 → 推送 tool_start → 执行工具 → 推送 tool_result → 继续循环
      否 → 推送 done，结束
  （最多循环 10 次防止死循环）
```

### 数据流（前端）

```
chat-workspace.tsx（主控）
  ├── 读取 useChatStore（对话/消息）
  ├── 读取 useConfigStore（当前 LLM 配置）
  ├── 发起 fetch SSE 请求
  ├── 解析 SSE 事件 → 更新 store（appendMessageContent / updateToolCall）
  └── 驱动 MessageList + ToolPanel 实时渲染
```

---

## 技能系统

### 技能结构（`lib/skills/registry.ts`）

```typescript
interface Skill {
  id: string           // 唯一 ID
  name: string         // 显示名称
  icon: string         // emoji 图标
  description: string  // 描述
  category: "writing" | "image" | "code" | "search" | "general"
  systemPrompt: string // 注入给 LLM 的系统提示
  tools: string[]      // 允许调用的工具名列表
  inputForm?: FormField[] // 首次对话的引导表单（可选）
}
```

### 现有技能

| ID | 名称 | 工具 | 说明 |
|----|------|------|------|
| `xiaohongshu` | 小红书创作 | web_search, generate_image | 生成文案 + 配图 |
| `web_research` | 网络调研 | web_search | 多轮搜索整合报告 |
| `general` | 通用助手 | web_search, generate_image | 自由对话 |

### 新增技能方法

在 `lib/skills/registry.ts` 的 `SKILLS` 数组中添加新对象即可，无需其他改动。

---

## 工具系统

### 工具结构（`lib/agent/tools.ts`）

```typescript
// 1. 在 TOOL_DEFINITIONS 中注册工具 schema（供 LLM 调用）
TOOL_DEFINITIONS["my_tool"] = {
  name: "my_tool",
  description: "...",
  parameters: { type: "object", properties: { ... }, required: [...] }
}

// 2. 在 executeTool 的 switch 中添加执行逻辑
case "my_tool":
  return executeMyTool(input.param as string)
```

### 现有工具

| 工具名 | 说明 | API 依赖 |
|--------|------|----------|
| `web_search` | DuckDuckGo 即时答案搜索 | 无（免费） |
| `generate_image` | DALL-E 3 图片生成 | OpenAI API Key |

### 工具面板渲染（`components/chat/tool-panel.tsx`）

- 每个工具调用渲染一个可展开卡片
- 支持状态：`pending / running / done / error`
- `generate_image` 工具有专属渲染（直接展示图片）
- `web_search` 工具有专属渲染（摘要 + 来源链接）
- 新工具如需特殊展示，在 `ToolOutput` 组件中添加 case

---

## LLM 配置

### 支持的提供商

| Provider | 端点 | 备注 |
|----------|------|------|
| `openai` | `https://api.openai.com/v1/chat/completions` | 默认 |
| `anthropic` | `https://api.anthropic.com/v1/messages` | 目前走 OpenAI 兼容格式 |
| `custom` | 用户自填 baseURL | 兼容 OpenAI 格式的任意端点（Ollama、通义等） |

### 配置持久化

- 存储在 `localStorage`，key：`agent-llm-config`
- 支持多配置，标记默认配置
- 前端通过 `useConfigStore().getDefaultConfig()` 获取当前配置

---

## 状态管理

### chat-store（内存，页面刷新丢失）

```typescript
useChatStore()
  .conversations[]         // 所有对话
  .activeConversationId    // 当前激活对话
  .createConversation()    // 新建对话
  .addMessage()            // 添加消息
  .appendMessageContent()  // 流式追加内容
  .addToolCall()           // 添加工具调用记录
  .updateToolCall()        // 更新工具调用状态
```

> ⚠️ 当前对话历史不持久化，刷新后丢失。持久化方案见待办。

### config-store（localStorage 持久化）

```typescript
useConfigStore()
  .configs[]               // 所有 LLM 配置
  .defaultConfigId         // 默认配置 ID
  .addConfig()
  .updateConfig()
  .deleteConfig()
  .setDefault()
  .getDefaultConfig()      // 获取默认配置对象
```

---

## 待办 / 后续功能

### P0 - 核心体验

- [x] **Markdown 渲染**：`react-markdown` + `remark-gfm`，AI 消息气泡内渲染；用户消息保持纯文本。支持标题、列表、加粗、行内代码、代码块、表格、引用、链接
- [ ] **对话历史持久化**：chat-store 改用 Zustand `persist` 存 localStorage（注意大对话体积）
- [ ] **错误提示优化**：API Key 错误、网络错误给出友好提示
- [ ] **工具搜索升级**：接入 Tavily / Serper API（比 DuckDuckGo 结果更丰富），需用户填 Key
- [ ] **图片生成独立配置**：`generate_image` 工具支持配置独立的图片生成端点和模型（与对话模型解耦），适配 SD、Midjourney API 等

### P1 - 功能完善

- [ ] **代码高亮**：安装 `react-syntax-highlighter`，识别 AI 输出的代码块
- [ ] **消息复制**：每条消息添加一键复制按钮
- [ ] **对话重命名**：侧边栏双击对话标题可编辑
- [ ] **小红书预览**：工具面板增加小红书笔记预览卡（标题 + 正文 + 标签的排版展示）
- [ ] **流式中断恢复**：停止后允许继续上下文对话

### P2 - 扩展功能

- [ ] **更多技能**：代码生成、PPT 大纲、邮件撰写、数据分析
- [ ] **更多工具**：
  - `read_url`：抓取网页内容
  - `run_code`：沙箱执行 Python/JS（需 Docker）
  - `search_image`：图片搜索
- [ ] **技能自定义**：用户可在界面创建自定义技能（填写名称、System Prompt、选择工具）
- [ ] **模型参数配置**：temperature、max_tokens 可调

### P3 - 平台化

- [ ] **用户登录注册**：NextAuth.js（支持邮箱/GitHub OAuth）
- [ ] **积分系统**：数据库存用户积分，按 Token 消耗扣减，后台统一管理 API Key
- [ ] **后台管理页**：`/admin` 路由，管理用户、积分、API 用量统计
- [ ] **Electron 桌面端**：用 `nextron` 包装，API Key 存本机 keychain

---

## 开发规范

### 新增技能 checklist

1. 在 `lib/skills/registry.ts` → `SKILLS` 数组添加技能对象
2. 如需新工具，在 `lib/agent/tools.ts` 注册并实现
3. 如工具需要特殊 UI 展示，在 `components/chat/tool-panel.tsx` → `ToolOutput` 添加 case
4. 在 `components/chat/tool-panel.tsx` → `TOOL_LABELS` 添加工具中文名

### 本地开发

```bash
cd agent-platform
npm run dev       # 开发服务器 http://localhost:3000
npm run build     # 生产构建
npm run start     # 生产启动
```

### 环境说明

- 无 `.env` 文件，API Key 全部由用户在界面配置，存 localStorage
- 后续如需服务端统一 Key，在 `.env.local` 中配置并在 API Route 读取
