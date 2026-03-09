# Claude Chat Analyzer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a root-level Vite + React + TypeScript app that analyzes pasted Claude-style chat capture data and presents a side-by-side event timeline and reconstructed conversation view for SSE text and dialogue JSON.

**Architecture:** Create a small SPA in the repository root, separate from `sse解析工具/`, but reuse its proven parsing and visualization patterns. Normalize both input types into one analysis result shape so the UI can render a consistent left timeline and right conversation panel without mode-specific branching scattered across components.

**Tech Stack:** Vite, React, TypeScript

---

### Task 1: Scaffold the root-level frontend app

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/styles.css`
- Create: `.gitignore` (if root app entries are missing in worktree)

**Step 1: Write the failing bootstrap expectation**

Document expected files and commands in code comments or plan notes:
- `npm install`
- `npm run dev`
- `npm run build`

Expected initial failure before files exist: Vite cannot start because `package.json` and `index.html` are missing.

**Step 2: Create the minimal Vite + React + TypeScript app files**

Implement only the scripts and configuration required for local development and build. Do not add testing, linting, routing, or state libraries.

**Step 3: Add a minimal shell UI**

Render a placeholder page from `src/App.tsx` proving the root app is mounted.

**Step 4: Run build to verify the scaffold works**

Run: `npm install && npm run build`
Expected: build succeeds and outputs `dist/`

**Step 5: Commit**

```bash
git add package.json tsconfig.json vite.config.ts index.html src/main.tsx src/App.tsx src/styles.css .gitignore
git commit -m "feat: scaffold claude chat analyzer"
```

### Task 2: Define analysis data contracts

**Files:**
- Create: `src/types.ts`
- Modify: `src/App.tsx`

**Step 1: Write the failing type-driven usage**

In `src/App.tsx`, sketch state typed against missing interfaces such as:
- `InputMode`
- `AnalysisResult`
- `TimelineEvent`
- `ConversationMessage`
- `ConversationPart`
- `AnalysisSummary`

Expected: TypeScript fails because these types do not exist.

**Step 2: Create the minimal shared types**

Model only what the UI needs for first version:
- mode detection result
- left timeline items
- right reconstructed messages
- summary counts
- parse warnings/errors

Keep types protocol-aware but not over-generalized.

**Step 3: Update `src/App.tsx` to use the new types**

Replace placeholder state with typed app state.

**Step 4: Run build to verify types compile**

Run: `npm run build`
Expected: build succeeds with the new type definitions.

**Step 5: Commit**

```bash
git add src/types.ts src/App.tsx
git commit -m "feat: add analyzer data contracts"
```

### Task 3: Implement input detection and dialogue normalization

**Files:**
- Create: `src/parser/inputDetector.ts`
- Create: `src/parser/dialogueParser.ts`
- Modify: `src/types.ts`
- Test manually with: `dialogue.json`

**Step 1: Write the failing integration path**

Update `src/App.tsx` to call missing functions:
- `detectInputMode(raw)`
- `parseDialogue(raw)`

Expected: build fails because parser files do not exist.

**Step 2: Implement input detection**

Rules:
- If JSON parses and has `messages` array → `dialogue`
- Else if raw text contains repeated `data:` / `event:` structure → `sse`
- Else → `unknown`

**Step 3: Implement dialogue normalization**

Convert raw `dialogue.json` into:
- summary counts
- left timeline items derived from message turns
- right-side normalized conversation messages preserving role and parts

Handle `system` role as a visible section or tagged message, but do not invent protocol fields.

**Step 4: Run build and do a manual sample check**

Run: `npm run build`
Expected: build succeeds and pasted `dialogue.json` produces timeline + conversation output.

**Step 5: Commit**

```bash
git add src/parser/inputDetector.ts src/parser/dialogueParser.ts src/types.ts src/App.tsx
git commit -m "feat: support dialogue capture analysis"
```

### Task 4: Implement SSE parsing and chat reconstruction

**Files:**
- Create: `src/parser/sseParser.ts`
- Create: `src/parser/chatReconstructor.ts`
- Modify: `src/types.ts`
- Test manually with: `sse.txt`

**Step 1: Write the failing integration path**

Update `src/App.tsx` to call missing functions:
- `parseRawSSE(raw)`
- `reconstructConversation(events)`

Expected: build fails because parser files do not exist.

**Step 2: Implement SSE event parsing**

Support the first-version C1 scope:
- raw pasted SSE text
- optional HTTP response headers before stream body
- `data:` blocks separated by blank lines
- `[DONE]` sentinel handling

Preserve the original payload on each timeline item.

**Step 3: Implement reconstruction for chunked chat output**

Handle the sample structure from `sse.txt`:
- `choices[0].delta.content`
- `choices[0].delta.role`
- `choices[0].finish_reason`
- final `usage`

Output a normalized assistant message and summary data. If reconstruction is partial, emit warnings rather than failing silently.

**Step 4: Run build and manual sample check**

Run: `npm run build`
Expected: build succeeds and pasted `sse.txt` shows timeline items and a reconstructed assistant response.

**Step 5: Commit**

```bash
git add src/parser/sseParser.ts src/parser/chatReconstructor.ts src/types.ts src/App.tsx
git commit -m "feat: support sse capture reconstruction"
```

### Task 5: Build the analyzer UI

**Files:**
- Create: `src/components/InputPanel.tsx`
- Create: `src/components/SummaryBar.tsx`
- Create: `src/components/TimelinePanel.tsx`
- Create: `src/components/ConversationPanel.tsx`
- Create: `src/components/EmptyState.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

**Step 1: Write the failing component imports**

Replace the shell UI with imports for missing components.
Expected: build fails because component files do not exist.

**Step 2: Implement the input panel**

Provide:
- title
- paste textarea
- analyze button
- clear button
- detected mode badge

Do not add file upload or example loader buttons in this first version.

**Step 3: Implement the summary, timeline, and conversation panels**

Requirements:
- left column: chronological event/message timeline
- right column: reconstructed chat content
- top summary: counts and warnings
- unknown mode: explicit empty/error state

**Step 4: Style the layout**

Keep CSS self-contained and readable. Match the clean two-panel debugging feel of the reference app without copying unrelated branding.

**Step 5: Run build**

Run: `npm run build`
Expected: complete UI builds successfully.

**Step 6: Commit**

```bash
git add src/components src/App.tsx src/styles.css
git commit -m "feat: add analyzer interface"
```

### Task 6: Integrate the full analysis flow

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/parser/inputDetector.ts`
- Modify: `src/parser/dialogueParser.ts`
- Modify: `src/parser/sseParser.ts`
- Modify: `src/parser/chatReconstructor.ts`

**Step 1: Wire the end-to-end analyze action**

Flow:
- validate input
- detect mode
- branch to parser
- normalize into one `AnalysisResult`
- render both panels

**Step 2: Add user-facing error and warning handling**

Show clear messages for:
- empty input
- unknown input
- parse failure
- partial reconstruction

**Step 3: Run build and manual regression checks**

Run: `npm run build`
Expected: build passes.

Manual checks:
- paste `dialogue.json`
- paste `sse.txt`
- paste invalid text

Expected:
- `dialogue.json` → timeline + reconstructed messages
- `sse.txt` → timeline + reconstructed assistant output
- invalid text → explicit unsupported-input state

**Step 4: Commit**

```bash
git add src/App.tsx src/parser src/types.ts
git commit -m "feat: integrate analyzer workflows"
```

### Task 7: Update repository guidance

**Files:**
- Modify: `CLAUDE.md`
- Optionally modify: `README.md`

**Step 1: Update root guidance**

Add the new root app commands and architecture notes so future Claude instances do not assume the only runnable app is `sse解析工具/`.

**Step 2: Keep notes minimal and factual**

Document only confirmed scripts, entry points, and the distinction between:
- tracked root analyzer app
- untracked reference project in `sse解析工具/`

**Step 3: Run build again after doc-sensitive path references**

Run: `npm run build`
Expected: still passes.

**Step 4: Commit**

```bash
git add CLAUDE.md README.md
 git commit -m "docs: document claude chat analyzer"
```
