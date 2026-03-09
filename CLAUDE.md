# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目定位

当前仓库根目录正在开发一个新的 Claude 聊天抓包分析器。它是一个基于 Vite + React + TypeScript 的前端单页应用，源码位于仓库根目录。

同时，仓库中还保留了 `sse解析工具/` 目录。该目录目前只作为历史参考样例存在，不属于这次根目录分析器的提交范围，也不应被当作当前主应用来更新或扩展，除非任务明确要求。

## 需要明确区分的两部分

### 1. 根目录分析器（当前要维护、将提交）

以下内容属于当前仓库根目录的新分析器：

- `package.json`：根目录应用依赖与脚本。
- `index.html`：Vite 页面入口。
- `src/main.tsx`：React 挂载入口。
- `src/App.tsx`：主界面与分析流程入口。
- `src/parser/`：输入识别、dialogue 解析、SSE 解析、会话重建。
- `src/components/`：输入区、摘要栏、时间线、消息视图、空状态等界面组件。

### 2. `sse解析工具/`（仅参考、不提交）

- `sse解析工具/` 是仓库里保留的旧参考工具目录。
- 它有自己独立的 `package.json`、README 和模块级 `CLAUDE.md`。
- 在回答根目录分析器相关问题时，不要把 `sse解析工具/` 的架构、命令或能力误写成当前根目录应用事实。
- 如果需要对比历史实现，可以阅读它；但默认不要把该目录纳入当前任务实现范围。

## 根目录应用的真实开发命令

基于根目录 `package.json`，当前已确认的命令只有以下这些：

| 命令 | 位置 | 用途 |
|---|---|---|
| `npm install` | 仓库根目录 | 安装根目录应用依赖 |
| `npm run dev` | 仓库根目录 | 启动 Vite 开发服务器 |
| `npm run build` | 仓库根目录 | 执行 `tsc -b && vite build` 生成构建产物 |
| `npm run preview` | 仓库根目录 | 预览构建产物 |

注意：

- 当前不要编造 `test`、`lint`、`typecheck` 等命令。
- 根目录 `package.json` 中未定义这些脚本；协作时只能引用已确认存在的命令。

## 根目录应用架构总览

### 入口路径

- `index.html`：页面根节点。
- `src/main.tsx`：加载 `App` 并引入 `src/styles.css`。
- `src/App.tsx`：应用主入口，负责输入、识别模式、调用解析器并组织页面布局。

### 解析链路

根目录分析器当前支持两条输入路径：

1. `dialogue` 路径
   - `src/parser/inputDetector.ts` 先检测输入是否为包含 `messages` 数组的 JSON。
   - 若识别为 `dialogue`，则由 `src/parser/dialogueParser.ts` 解析为消息、时间线与问题列表。

2. `sse` 路径
   - `src/parser/inputDetector.ts` 通过文本特征识别 SSE。
   - `src/parser/sseParser.ts` 负责把原始 SSE 文本拆解为事件与解析问题。
   - `src/parser/chatReconstructor.ts` 基于已解析事件重建会话、摘要、时间线与告警信息。

### 组件结构

根目录界面组件集中在 `src/components/`：

- `InputPanel.tsx`：粘贴 `dialogue JSON` 或 `SSE` 文本并触发分析。
- `SummaryBar.tsx`：展示模式、状态、消息数、事件数、警告数、错误数和时间范围。
- `TimelinePanel.tsx`：展示事件时间线与问题列表。
- `ConversationPanel.tsx`：展示重建后的消息视图。
- `EmptyState.tsx`：无结果时的占位提示。

### 当前主界面职责

`src/App.tsx` 当前负责：

- 保存输入文本与分析结果状态。
- 调用 `inspectInput` 判断输入模式。
- 在 `dialogue` 模式下调用 `parseDialogue`。
- 在 `sse` 模式下调用 `parseRawSSE` 与 `reconstructConversation`。
- 将结果分发到摘要栏、时间线面板和消息面板。

## 样例文件用途

`dialogue.json` 与 `sse.txt` 是主工作区仓库根目录中的抓包样例文件，可用于分析器开发与手工验证；它们不是当前 worktree 内稳定存在的源码文件，也不应假定每个 worktree 都一定带有这两个样例。

- `dialogue.json`
  - 提供完整对话 JSON 样例。
  - 适合验证 `dialogue` 识别与 `src/parser/dialogueParser.ts` 的解析结果。

- `sse.txt`
  - 提供原始 SSE 文本样例。
  - 适合验证 `sse` 识别、`src/parser/sseParser.ts` 的事件拆分，以及 `src/parser/chatReconstructor.ts` 的重建结果。

## 协作约束

- 讨论“如何运行当前应用”时，默认指仓库根目录，而不是 `sse解析工具/`。
- 讨论“历史参考实现”时，再单独指出 `sse解析工具/`。
- 修改文档或说明时，先区分当前根目录分析器与旧参考工具，避免混写。
- `dialogue.json` 和 `sse.txt` 属于主工作区仓库根目录中的抓包样例，主要用于手工验证与分析输入；不要把它们写成每个 worktree 内稳定存在、待重构的源码文件。

## 变更记录 (Changelog)

- 2026-03-09：更新根级说明，改正 `dialogue.json`、`sse.txt` 在 worktree 中的表述，明确它们来自主工作区根目录样例，并保持与当前分析器 worktree 实际情况一致。
- 2026-03-09：更新根级说明，明确当前主应用已切换为仓库根目录分析器，并补充真实开发命令、入口结构、parser/components 分层，以及 `dialogue.json`、`sse.txt` 与 `sse解析工具/` 的角色边界。
