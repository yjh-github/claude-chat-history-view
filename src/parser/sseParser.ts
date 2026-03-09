import type { AnalysisIssue, ParsedSSE, ParsedSSEEvent } from '../types'

function normalizeNewlines(raw: string): string {
  return raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

function isHttpStatusLine(line: string): boolean {
  return /^HTTP\/\d(?:\.\d)?\s+\d{3}\b/i.test(line.trim())
}

function looksLikeHeaderLine(line: string): boolean {
  return /^[A-Za-z0-9-]+:\s*.+$/.test(line)
}

function createIssue(code: string, message: string, severity: AnalysisIssue['severity'], detail?: string, line?: number): AnalysisIssue {
  return {
    code,
    message,
    severity,
    detail,
    line,
  }
}

function parseEventBlock(block: string, eventIndex: number, startLine: number, issues: AnalysisIssue[]): ParsedSSEEvent | null {
  const lines = block.split('\n')
  let eventName: string | undefined
  const dataLines: string[] = []

  lines.forEach((line, index) => {
    if (line.startsWith(':')) {
      return
    }

    if (line.startsWith('event:')) {
      eventName = line.slice('event:'.length).trim() || undefined
      return
    }

    if (line.startsWith('data:')) {
      dataLines.push(line.slice('data:'.length).trimStart())
      return
    }

    if (line.trim().length > 0) {
      issues.push(
        createIssue(
          'SSE_UNSUPPORTED_LINE',
          '检测到当前版本未处理的 SSE 行，已忽略。',
          'warning',
          line,
          startLine + index,
        ),
      )
    }
  })

  if (dataLines.length === 0) {
    issues.push(
      createIssue('SSE_DATA_MISSING', '检测到不含 data 的 SSE block，已忽略。', 'warning', block, startLine),
    )
    return null
  }

  const data = dataLines.join('\n')
  const rawPayload = data
  const isDone = data.trim() === '[DONE]'

  if (isDone) {
    return {
      id: `sse-event-${eventIndex}`,
      event: eventName,
      line: startLine,
      rawPayload,
      data,
      isDone: true,
    }
  }

  try {
    return {
      id: `sse-event-${eventIndex}`,
      event: eventName,
      line: startLine,
      rawPayload,
      data,
      isDone: false,
      json: JSON.parse(data) as Record<string, unknown>,
    }
  } catch {
    issues.push(
      createIssue('SSE_JSON_INVALID', '检测到无法解析的 SSE data JSON。', 'warning', data, startLine),
    )

    return {
      id: `sse-event-${eventIndex}`,
      event: eventName,
      line: startLine,
      rawPayload,
      data,
      isDone: false,
    }
  }
}

export function parseRawSSE(raw: string): ParsedSSE {
  const text = normalizeNewlines(raw)
  const issues: AnalysisIssue[] = []
  const lines = text.split('\n')
  const headers: string[] = []
  let cursor = 0

  if (lines.length > 0 && isHttpStatusLine(lines[0])) {
    headers.push(lines[0])
    cursor = 1

    while (cursor < lines.length) {
      const line = lines[cursor]

      if (line.trim() === '') {
        cursor += 1
        break
      }

      if (looksLikeHeaderLine(line)) {
        headers.push(line)
        cursor += 1
        continue
      }

      issues.push(
        createIssue('SSE_HEADER_MALFORMED', 'HTTP 响应头区域存在无法识别的行。', 'warning', line, cursor + 1),
      )
      cursor += 1
    }
  }

  const body = lines.slice(cursor).join('\n').trim()

  if (body.length === 0) {
    issues.push(createIssue('SSE_BODY_EMPTY', 'SSE 解析失败：内容为空。', 'error'))
    return {
      headers,
      events: [],
      issues,
    }
  }

  const blocks = body.split(/\n\s*\n/)
  const events: ParsedSSEEvent[] = []
  let searchOffset = cursor

  blocks.forEach((block, index) => {
    const trimmedBlock = block.trim()

    if (trimmedBlock.length === 0) {
      return
    }

    const blockLines = trimmedBlock.split('\n')
    const firstLine = blockLines[0]
    const relativeIndex = lines.slice(searchOffset).findIndex((line) => line === firstLine)
    const startLine = relativeIndex >= 0 ? searchOffset + relativeIndex + 1 : searchOffset + 1

    const event = parseEventBlock(trimmedBlock, index, startLine, issues)
    if (event) {
      events.push(event)
    }

    searchOffset = startLine - 1 + blockLines.length
  })

  if (events.length === 0) {
    issues.push(createIssue('SSE_EVENTS_EMPTY', 'SSE 解析失败：未解析出任何 SSE 事件。', 'error'))
  }

  return {
    headers,
    events,
    issues,
  }
}
