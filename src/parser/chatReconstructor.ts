import type {
  AnalysisIssue,
  AnalysisResult,
  AnalysisSummary,
  ConversationMessage,
  ConversationPart,
  ConversationRole,
  ParsedSSEEvent,
  TimelineEvent,
} from '../types'

function createResult(result: Omit<AnalysisResult, 'messages'>): AnalysisResult {
  return {
    ...result,
    messages: result.conversation,
  }
}

function toIsoTimestamp(created: unknown): string | undefined {
  if (typeof created !== 'number' || !Number.isFinite(created)) {
    return undefined
  }

  return new Date(created * 1000).toISOString()
}

function toObject(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined
}

function toChoices(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => !!toObject(item)) : []
}

function toRole(value: unknown): ConversationRole {
  return value === 'system' || value === 'user' || value === 'assistant' || value === 'tool' ? value : 'unknown'
}

function buildAssistantMessage(text: string, role: ConversationRole, createdAt?: string, metadata?: Record<string, unknown>): ConversationMessage[] {
  if (!text.trim()) {
    return []
  }

  const parts: ConversationPart[] = [
    {
      id: 'sse-message-0-part-0',
      kind: 'text',
      text,
    },
  ]

  return [
    {
      id: 'sse-message-0',
      role,
      createdAt,
      parts,
      metadata,
    },
  ]
}

function buildSummary(conversation: ConversationMessage[], timeline: TimelineEvent[], warnings: AnalysisIssue[], errors: AnalysisIssue[]): AnalysisSummary {
  const timestamps = timeline.map((event) => event.timestamp).filter((value): value is string => Boolean(value))

  return {
    messageCount: conversation.length,
    eventCount: timeline.length,
    warningCount: warnings.length,
    errorCount: errors.length,
    startedAt: timestamps[0] ?? null,
    finishedAt: timestamps[timestamps.length - 1] ?? null,
  }
}

function hasPartialSignals(issues: AnalysisIssue[]): boolean {
  return issues.some((issue) =>
    [
      'SSE_JSON_INVALID',
      'SSE_CHOICES_MISSING',
      'SSE_MULTI_CHOICE_UNSUPPORTED',
      'SSE_DELTA_EMPTY',
      'SSE_DONE_MISSING',
      'SSE_USAGE_MISSING',
      'SSE_ROLE_UNKNOWN',
    ].includes(issue.code),
  )
}

// 当前重建器只服务于现有 sse.txt 样本：单条消息、单个 choices[0]、纯文本增量。
// 遇到更通用的 SSE 形态时，只做显式告警，不扩展为协议级重建器。
export function reconstructConversation(events: ParsedSSEEvent[], parserIssues: AnalysisIssue[] = []): AnalysisResult {
  const issues: AnalysisIssue[] = [...parserIssues]
  const timeline: TimelineEvent[] = []
  const contentChunks: string[] = []
  let assistantRole: ConversationRole = 'unknown'
  let finalUsage: Record<string, unknown> | undefined
  let messageMetadata: Record<string, unknown> | undefined
  let hasDoneSentinel = false

  events.forEach((event, index) => {
    if (event.isDone) {
      hasDoneSentinel = true
      timeline.push({
        id: `timeline-sse-${index}`,
        kind: 'status',
        level: 'info',
        label: 'SSE 完成',
        detail: '[DONE]',
        rawPayload: event.rawPayload,
      })
      return
    }

    if (!event.json) {
      timeline.push({
        id: `timeline-sse-${index}`,
        kind: 'warning',
        level: 'warning',
        label: '未解析事件',
        detail: event.data,
        rawPayload: event.rawPayload,
      })
      return
    }

    const chunk = event.json
    const createdAt = toIsoTimestamp(chunk.created)
    const choices = toChoices(chunk.choices)

    if (choices.length === 0) {
      issues.push({
        code: 'SSE_CHOICES_MISSING',
        message: '检测到缺少 choices 的 SSE 事件。当前重建器仅支持单消息样本中的 choices[0]。',
        severity: 'warning',
        line: event.line,
        detail: event.rawPayload,
      })

      timeline.push({
        id: `timeline-sse-${index}`,
        kind: 'warning',
        level: 'warning',
        label: '缺少 choices',
        timestamp: createdAt,
        detail: event.data,
        rawPayload: event.rawPayload,
        metadata: chunk,
      })
      return
    }

    if (choices.length > 1) {
      issues.push({
        code: 'SSE_MULTI_CHOICE_UNSUPPORTED',
        message: '检测到多个 choices。当前重建器仅按单消息样本读取 choices[0]，其余内容将忽略。',
        severity: 'warning',
        line: event.line,
        detail: event.rawPayload,
      })
    }

    const firstChoice = choices[0]
    const delta = toObject(firstChoice.delta) ?? {}
    const finishReason = typeof firstChoice.finish_reason === 'string' ? firstChoice.finish_reason : undefined
    const content = typeof delta.content === 'string' ? delta.content : undefined
    const role = toRole(delta.role)

    if (delta.role !== undefined) {
      assistantRole = role
    }

    if (content) {
      contentChunks.push(content)
    }

    const usage = toObject(chunk.usage)
    if (usage) {
      finalUsage = usage
    }

    if (!messageMetadata) {
      messageMetadata = {
        source: 'sse',
        model: chunk.model,
        responseId: chunk.id,
        object: chunk.object,
        reconstructionScope: 'single-message-sample-only',
      }
    }

    timeline.push({
      id: `timeline-sse-${index}`,
      kind: content ? 'message' : 'status',
      level: 'info',
      label: content ? 'assistant 增量' : finishReason ? 'assistant 完成' : 'SSE 事件',
      timestamp: createdAt,
      detail: content ?? finishReason ?? '[no-content]',
      messageId: 'sse-message-0',
      rawPayload: event.rawPayload,
      metadata: {
        finishReason,
        delta,
        usage,
      },
    })

    if (!content && !finishReason && Object.keys(delta).length === 0) {
      issues.push({
        code: 'SSE_DELTA_EMPTY',
        message: '检测到空 delta 事件，未产出内容。',
        severity: 'warning',
        line: event.line,
        detail: event.rawPayload,
      })
    }
  })

  if (!hasDoneSentinel) {
    issues.push({
      code: 'SSE_DONE_MISSING',
      message: 'SSE 流未检测到 [DONE] 结束标记，结果可能只完成了部分重建。',
      severity: 'warning',
    })
  }

  const reconstructedText = contentChunks.join('')

  if (!reconstructedText.trim()) {
    issues.push({
      code: 'SSE_MESSAGE_EMPTY',
      message: '未能从 SSE 事件中重建出 assistant 文本内容。',
      severity: 'error',
    })
  }

  const conversation = buildAssistantMessage(
    reconstructedText,
    assistantRole,
    timeline.find((event) => event.timestamp)?.timestamp,
    {
      ...messageMetadata,
      usage: finalUsage,
      chunkCount: contentChunks.length,
    },
  )

  if (assistantRole === 'unknown' && reconstructedText.trim()) {
    issues.push({
      code: 'SSE_ROLE_UNKNOWN',
      message: 'SSE 中的角色无法识别，重建结果中的消息 role 将保留为 unknown。',
      severity: 'warning',
    })
  }

  if (!finalUsage && reconstructedText.trim()) {
    issues.push({
      code: 'SSE_USAGE_MISSING',
      message: '未检测到最终 usage 统计。',
      severity: 'warning',
    })
  }

  if (reconstructedText.trim() && hasPartialSignals(issues)) {
    issues.push({
      code: 'SSE_PARTIAL_RECONSTRUCTION',
      message: '已重建出部分 assistant 输出，但原始 SSE 中仍存在未完整解析或被忽略的片段。',
      severity: 'warning',
    })
  }

  const warnings = issues.filter((issue) => issue.severity === 'warning')
  const errors = issues.filter((issue) => issue.severity === 'error')
  const summary = buildSummary(conversation, timeline, warnings, errors)

  return createResult({
    status: errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'ready',
    summary,
    conversation,
    rawToolMessages: [],
    timeline,
    issues,
    warnings,
    errors,
  })
}
