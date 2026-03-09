# Claude 聊天抓包分析工具

一个基于 Vite + React + TypeScript 的前端单页应用，用于分析 Claude 聊天相关抓包数据，并将原始输入重建为更适合阅读和排查的问题视图。

当前应用支持两类输入：

- `dialogue JSON`：包含 `messages` 数组的对话结构数据
- `SSE 文本`：原始流式事件文本

它适合用于以下场景：

- 排查 Claude 对话或抓包数据中的结构异常
- 观察消息、事件与时间线之间的关系
- 从原始 SSE 事件中重建会话过程
- 快速定位 warning / error 等解析问题

## 核心能力

- 自动识别输入类型：`dialogue` / `sse` / `unknown`
- 解析并展示消息内容、事件时间线和问题列表
- 从 SSE 事件中重建会话消息视图
- 汇总展示状态、消息数、事件数、告警数、错误数和时间范围
- 通过统一界面辅助调试和结构化分析

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动开发环境

```bash
npm run dev
```

### 构建生产版本

```bash
npm run build
```

### 预览构建结果

```bash
npm run preview
```

## 使用方式

1. 启动应用后，在输入面板中粘贴 `dialogue JSON` 或 `SSE` 原始文本。
2. 应用会根据输入内容自动识别当前模式。
3. 点击分析后，界面会输出以下结果：
   - **Summary Bar**：展示模式、状态、消息数、事件数、告警数、错误数、时间范围
   - **Timeline Panel**：展示事件时间线和解析问题
   - **Conversation Panel**：展示重建后的会话内容
4. 当输入为空或暂时无法形成结果时，会显示空状态提示。

## 界面截图

> 可在此处放置应用主界面截图，建议截图内容包含输入区、摘要栏、时间线和会话面板。

```md
![Claude 聊天抓包分析工具界面截图](./docs/images/app-overview.png)
```

如果后续你准备补充多张图片，也可以按下面的形式继续扩展：

```md
### 输入与识别
![输入面板截图](./docs/images/input-panel.png)

### 时间线与问题列表
![时间线面板截图](./docs/images/timeline-panel.png)

### 会话重建结果
![会话面板截图](./docs/images/conversation-panel.png)
```

## 项目结构

```text
.
├── index.html
├── package.json
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── types.ts
│   ├── components/
│   │   ├── ConversationPanel.tsx
│   │   ├── EmptyState.tsx
│   │   ├── InputPanel.tsx
│   │   ├── SummaryBar.tsx
│   │   └── TimelinePanel.tsx
│   └── parser/
│       ├── chatReconstructor.ts
│       ├── dialogueParser.ts
│       ├── inputDetector.ts
│       └── sseParser.ts
```

## 主要模块说明

### 应用入口

- `src/main.tsx`：挂载 React 应用并加载全局样式
- `src/App.tsx`：负责输入状态、模式识别、触发解析和组织页面布局

### 界面组件

- `src/components/InputPanel.tsx`：输入文本、触发分析、执行重置
- `src/components/SummaryBar.tsx`：展示整体分析摘要
- `src/components/TimelinePanel.tsx`：展示事件时间线与问题列表
- `src/components/ConversationPanel.tsx`：展示重建后的消息视图
- `src/components/EmptyState.tsx`：无结果时的占位提示

### 解析模块

- `src/parser/inputDetector.ts`：检测输入属于 `dialogue`、`sse` 还是 `unknown`
- `src/parser/dialogueParser.ts`：解析 `dialogue JSON`
- `src/parser/sseParser.ts`：拆解原始 SSE 文本为事件与问题
- `src/parser/chatReconstructor.ts`：基于 SSE 事件重建会话结果

## 解析链路

### 1. dialogue 路径

当输入被识别为包含 `messages` 数组的 JSON 时：

1. `src/parser/inputDetector.ts` 识别输入类型
2. `src/parser/dialogueParser.ts` 解析消息、时间线和问题列表
3. 结果交给界面统一展示

### 2. sse 路径

当输入被识别为 SSE 文本时：

1. `src/parser/inputDetector.ts` 识别输入类型
2. `src/parser/sseParser.ts` 将原始文本拆解为事件与解析问题
3. `src/parser/chatReconstructor.ts` 基于事件重建会话、摘要和时间线
4. 结果交给界面统一展示

## 样例输入

仓库根目录中的以下文件可用于手工验证：

- `dialogue.json`：完整对话 JSON 样例，适合验证 `dialogue` 解析路径
- `sse.txt`：原始 SSE 文本样例，适合验证事件拆分与会话重建路径

注意：这些样例文件主要用于开发和手工验证，不应视为应用运行所必需的源码文件。

## 技术栈

- React 18
- TypeScript 5
- Vite 5

## 当前定位

这个仓库当前维护的是**根目录下的新分析器应用**。如果仓库中存在其他历史参考目录，它们默认不属于当前主应用的实现范围；阅读和修改时应优先以根目录应用为准。
