import type { AnalysisIssue, InputMode } from '../types'

const repeatedSsePattern = /(?:^|\n)\s*(?:event|data):[\s\S]*?(?:\n\s*(?:event|data):){2,}/
const httpSsePattern = /^HTTP\/\d(?:\.\d)?\s+\d{3}[\s\S]*?\n\s*content-type:\s*text\/event-stream\b/im
const sseDataOnlyPattern = /(?:^|\n)\s*data:\s*(?:\{.*|\[DONE\]|.+)(?:\n\s*data:\s*.+){0,}/

export interface InputInspectionResult {
  normalized: string
  mode: InputMode
  validationIssue?: AnalysisIssue
}

function createIssue(code: string, message: string): AnalysisIssue {
  return {
    code,
    message,
    severity: 'error',
  }
}

export function detectInputMode(raw: string): InputMode {
  const text = raw.trim()

  if (text.length === 0) {
    return 'unknown'
  }

  try {
    const parsed = JSON.parse(text) as { messages?: unknown }

    if (Array.isArray(parsed?.messages)) {
      return 'dialogue'
    }
  } catch {
    // Ignore invalid JSON and continue with text-based heuristics.
  }

  if (repeatedSsePattern.test(text) || httpSsePattern.test(text) || sseDataOnlyPattern.test(text)) {
    return 'sse'
  }

  return 'unknown'
}

export function inspectInput(raw: string): InputInspectionResult {
  const normalized = raw.trim()

  if (normalized.length === 0) {
    return {
      normalized,
      mode: 'unknown',
      validationIssue: createIssue('INPUT_EMPTY', '输入为空，请粘贴 dialogue.json 或 SSE 文本后再分析。'),
    }
  }

  const mode = detectInputMode(normalized)

  if (mode === 'unknown') {
    return {
      normalized,
      mode,
      validationIssue: createIssue('INPUT_UNSUPPORTED', '无法识别输入类型，请提供 dialogue JSON 或 SSE 文本。'),
    }
  }

  return {
    normalized,
    mode,
  }
}
