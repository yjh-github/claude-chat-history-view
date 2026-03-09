import type {
  AnalysisIssue,
  AnalysisResult,
  AnalysisSummary,
  ConversationMessage,
  ConversationPart,
  ConversationRole,
  TimelineEvent,
} from '../types'

type DialogueContentItem = {
  type?: string
  text?: string
  [key: string]: unknown
}

type DialogueToolCall = {
  id?: string
  type?: string
  function?: {
    name?: string
    arguments?: string
  }
  [key: string]: unknown
}

type DialogueMessage = {
  role?: string
  content?: string | DialogueContentItem[]
  tool_calls?: DialogueToolCall[]
  tool_call_id?: string
  created_at?: string
  createdAt?: string
  [key: string]: unknown
}

type DialogueDocument = {
  messages?: DialogueMessage[]
  [key: string]: unknown
}

const emptySummary: AnalysisSummary = {
  messageCount: 0,
  eventCount: 0,
  warningCount: 0,
  errorCount: 0,
  startedAt: null,
  finishedAt: null,
}

function isConversationRole(role: string): role is Exclude<ConversationRole, 'unknown'> {
  return role === 'system' || role === 'user' || role === 'assistant' || role === 'tool'
}

function toRole(role: string | undefined): ConversationRole {
  if (role && isConversationRole(role)) {
    return role
  }

  return 'unknown'
}

function toText(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const text = value.trim()
    return text.length > 0 ? text : undefined
  }

  return undefined
}

function stringifyCompact(value: unknown): string | undefined {
  if (value == null) {
    return undefined
  }

  if (typeof value === 'string') {
    return value
  }

  try {
    return JSON.stringify(value)
  } catch {
    return undefined
  }
}

function parseStructuredString(value: string): unknown {
  const normalized = value.trim()

  if (!normalized.startsWith('{') && !normalized.startsWith('[')) {
    return undefined
  }

  try {
    return JSON.parse(normalized)
  } catch {
    return undefined
  }
}

function inferPartKind(itemType: string): ConversationPart['kind'] {
  if (itemType === 'text') {
    return 'text'
  }

  if (itemType === 'thinking' || itemType === 'reasoning') {
    return 'reasoning'
  }

  if (itemType === 'tool_use') {
    return 'tool-use'
  }

  if (itemType === 'tool_result') {
    return 'tool-result'
  }

  return 'unknown'
}

function normalizeStructuredToolContent(value: unknown, messageId: string): ConversationPart[] {
  const items = Array.isArray(value) ? value : [value]
  const parts: ConversationPart[] = []

  items.forEach((item, index) => {
    const itemType = typeof item === 'object' && item && typeof (item as DialogueContentItem).type === 'string'
      ? (item as DialogueContentItem).type!
      : 'tool_result'
    const text = stringifyCompact(item)

    if (!text) {
      return
    }

    parts.push({
      id: `${messageId}-tool-result-${index}`,
      kind: inferPartKind(itemType) === 'unknown' ? 'tool-result' : inferPartKind(itemType),
      text,
      metadata: typeof item === 'object' && item ? (item as Record<string, unknown>) : { value: item },
    })
  })

  return parts
}

function normalizeContentParts(content: DialogueMessage['content'], message: DialogueMessage, messageId: string): ConversationPart[] {
  if (typeof content === 'string') {
    const text = toText(content)

    if (!text) {
      return []
    }

    if (message.role === 'tool') {
      const structured = parseStructuredString(text)
      if (structured !== undefined) {
        return normalizeStructuredToolContent(structured, messageId)
      }

      return [
        {
          id: `${messageId}-part-0`,
          kind: 'tool-result',
          text,
          metadata: message.tool_call_id ? { toolCallId: message.tool_call_id } : undefined,
        },
      ]
    }

    return [
      {
        id: `${messageId}-part-0`,
        kind: 'text',
        text,
      },
    ]
  }

  if (!Array.isArray(content)) {
    return []
  }

  return content.map((item, index) => {
    const itemType = typeof item?.type === 'string' ? item.type : 'unknown'
    const partId = `${messageId}-part-${index}`
    const kind = inferPartKind(itemType)
    const itemText = toText(item?.text) ?? stringifyCompact(item)

    return {
      id: partId,
      kind,
      text: itemText,
      metadata: item,
    }
  })
}

function normalizeToolCalls(toolCalls: DialogueToolCall[] | undefined, messageId: string): ConversationPart[] {
  if (!Array.isArray(toolCalls)) {
    return []
  }

  return toolCalls.map((toolCall, index) => {
    const functionName = toText(toolCall.function?.name)
    const argumentsText = toText(toolCall.function?.arguments)
    const summaryText = [functionName, argumentsText].filter(Boolean).join(' ')

    return {
      id: toolCall.id ?? `${messageId}-tool-call-${index}`,
      kind: 'tool-use',
      text: summaryText || '[tool-use]',
      metadata: toolCall,
    }
  })
}

function normalizeMessage(message: DialogueMessage, index: number, toolResultParts: ConversationPart[] = []): ConversationMessage {
  const messageId = `message-${index}`
  const contentParts = normalizeContentParts(message.content, message, messageId)
  const toolCallParts = normalizeToolCalls(message.tool_calls, messageId)
  const parts = [...contentParts, ...toolCallParts, ...toolResultParts]

  if (parts.length === 0) {
    parts.push({
      id: `${messageId}-part-empty`,
      kind: 'unknown',
      text: '[empty]',
    })
  }

  return {
    id: messageId,
    role: toRole(message.role),
    createdAt: toText(message.created_at) ?? toText(message.createdAt),
    parts,
    metadata: message,
  }
}

function buildConversation(messages: DialogueMessage[]): ConversationMessage[] {
  const conversation: ConversationMessage[] = []
  const consumedToolIndexes = new Set<number>()

  for (let index = 0; index < messages.length; index += 1) {
    if (consumedToolIndexes.has(index)) {
      continue
    }

    const message = messages[index]
    const toolCalls = Array.isArray(message.tool_calls) ? message.tool_calls : []
    const toolCallIds = new Set(toolCalls.map((toolCall) => toolCall.id).filter((id): id is string => Boolean(id)))

    if (message.role === 'assistant' && toolCallIds.size > 0) {
      const mergedToolResults: ConversationPart[] = []

      for (let nextIndex = index + 1; nextIndex < messages.length; nextIndex += 1) {
        const nextMessage = messages[nextIndex]
        const nextRole = toRole(nextMessage.role)
        const nextToolCallId = toText(nextMessage.tool_call_id)

        if (nextRole === 'tool' && nextToolCallId && toolCallIds.has(nextToolCallId)) {
          const mergedParts = normalizeContentParts(nextMessage.content, nextMessage, `message-${index}-tool-${nextIndex}`).map((part, partIndex) => ({
            ...part,
            id: `${part.id}-merged-${partIndex}`,
            metadata: {
              ...(part.metadata ?? {}),
              toolCallId: nextToolCallId,
              mergedFromRole: 'tool',
              mergedFromIndex: nextIndex,
            },
          }))

          mergedToolResults.push(...mergedParts)
          consumedToolIndexes.add(nextIndex)
          continue
        }

        if (nextRole !== 'tool') {
          break
        }
      }

      conversation.push(normalizeMessage(message, index, mergedToolResults))
      continue
    }

    conversation.push(normalizeMessage(message, index))
  }

  return conversation
}

function buildRawToolMessages(messages: DialogueMessage[]): ConversationMessage[] {
  return messages
    .map((message, index) => ({ message, index }))
    .filter(({ message }) => toRole(message.role) === 'tool')
    .map(({ message, index }) => normalizeMessage(message, index))
}

function buildTimelineDetail(message: ConversationMessage): string {
  const textParts = message.parts.filter((part) => part.kind === 'text').map((part) => part.text?.trim()).filter((text): text is string => Boolean(text))
  const toolUseCount = message.parts.filter((part) => part.kind === 'tool-use').length
  const toolResultCount = message.parts.filter((part) => part.kind === 'tool-result').length
  const reasoningCount = message.parts.filter((part) => part.kind === 'reasoning').length

  const segments: string[] = []

  if (textParts.length > 0) {
    const textPreview = textParts.join(' ').replace(/\s+/g, ' ').trim()
    segments.push(textPreview.length > 120 ? `${textPreview.slice(0, 120)}…` : textPreview)
  }

  if (toolUseCount > 0 || toolResultCount > 0) {
    const toolSegments: string[] = []

    if (toolUseCount > 0) {
      toolSegments.push(`${toolUseCount} 次工具调用`)
    }

    if (toolResultCount > 0) {
      toolSegments.push(`${toolResultCount} 条工具结果`)
    }

    segments.push(toolSegments.join('，'))
  }

  if (reasoningCount > 0) {
    segments.push(`${reasoningCount} 段 reasoning`)
  }

  if (segments.length === 0) {
    const fallback = message.parts.map((part) => part.text ?? `[${part.kind}]`).join(' ').trim()
    return fallback || '[empty]'
  }

  return segments.join(' · ')
}

function buildTimelineLabel(message: ConversationMessage): string {
  const toolUseCount = message.parts.filter((part) => part.kind === 'tool-use').length
  const toolResultCount = message.parts.filter((part) => part.kind === 'tool-result').length

  if (message.role === 'assistant' && (toolUseCount > 0 || toolResultCount > 0)) {
    return 'assistant 工具链'
  }

  return `${message.role} 消息`
}

function buildTimelineMetadata(message: ConversationMessage): Record<string, unknown> | undefined {
  const toolUseCount = message.parts.filter((part) => part.kind === 'tool-use').length
  const toolResultCount = message.parts.filter((part) => part.kind === 'tool-result').length
  const textCount = message.parts.filter((part) => part.kind === 'text').length

  if (toolUseCount === 0 && toolResultCount === 0) {
    return undefined
  }

  return {
    textCount,
    toolUseCount,
    toolResultCount,
  }
}

function buildTimeline(conversation: ConversationMessage[]): TimelineEvent[] {
  return conversation.map((message, index) => ({
    id: `timeline-${index}`,
    kind: 'message',
    level: message.role === 'unknown' ? 'warning' : 'info',
    label: buildTimelineLabel(message),
    detail: buildTimelineDetail(message),
    messageId: message.id,
    timestamp: message.createdAt,
    metadata: buildTimelineMetadata(message),
  }))
}

function buildIssues(document: DialogueDocument, conversation: ConversationMessage[]): AnalysisIssue[] {
  const issues: AnalysisIssue[] = []

  if (!Array.isArray(document.messages)) {
    issues.push({
      code: 'DIALOGUE_MESSAGES_MISSING',
      message: '输入 JSON 缺少 messages 数组。',
      severity: 'error',
      path: 'messages',
    })

    return issues
  }

  if (document.messages.length === 0) {
    issues.push({
      code: 'DIALOGUE_MESSAGES_EMPTY',
      message: 'messages 数组为空。',
      severity: 'warning',
      path: 'messages',
    })
  }

  if (!conversation.some((message) => message.role === 'system')) {
    issues.push({
      code: 'SYSTEM_MESSAGE_MISSING',
      message: '未检测到 system 角色消息。',
      severity: 'warning',
      path: 'messages',
    })
  }

  if (conversation.some((message) => message.role === 'unknown')) {
    issues.push({
      code: 'UNKNOWN_ROLE_DETECTED',
      message: '检测到无法归一化的消息角色，已保留为 unknown。',
      severity: 'warning',
      path: 'messages',
    })
  }

  if (conversation.some((message) => message.parts.some((part) => part.kind === 'unknown'))) {
    issues.push({
      code: 'DIALOGUE_PARTIAL_RECONSTRUCTION',
      message: 'dialogue 中存在无法精确归类的消息片段，已按 unknown 保留并继续展示。',
      severity: 'warning',
      path: 'messages',
    })
  }

  return issues
}

function createResult(result: Omit<AnalysisResult, 'messages' | 'rawToolMessages'> & { rawToolMessages?: AnalysisResult['rawToolMessages'] }): AnalysisResult {
  return {
    ...result,
    messages: result.conversation,
    rawToolMessages: result.rawToolMessages ?? [],
  }
}

export function parseDialogue(raw: string): AnalysisResult {
  let document: DialogueDocument

  try {
    document = JSON.parse(raw) as DialogueDocument
  } catch {
    const errors: AnalysisIssue[] = [
      {
        code: 'DIALOGUE_JSON_INVALID',
        message: 'dialogue 解析失败：输入不是合法的 JSON。',
        severity: 'error',
      },
    ]

    return createResult({
      status: 'error',
      summary: {
        ...emptySummary,
        errorCount: errors.length,
      },
      conversation: [],
      rawToolMessages: [],
      timeline: [],
      issues: errors,
      warnings: [],
      errors,
    })
  }

  const rawMessages = Array.isArray(document.messages) ? document.messages : []
  const conversation = buildConversation(rawMessages)
  const rawToolMessages = buildRawToolMessages(rawMessages)
  const timeline = buildTimeline(conversation)
  const issues = buildIssues(document, conversation)
  const warnings = issues.filter((issue) => issue.severity === 'warning')
  const errors = issues.filter((issue) => issue.severity === 'error')
  const summary: AnalysisSummary = {
    messageCount: conversation.length,
    eventCount: timeline.length,
    warningCount: warnings.length,
    errorCount: errors.length,
    startedAt: timeline.find((event) => event.timestamp)?.timestamp ?? null,
    finishedAt: [...timeline].reverse().find((event) => event.timestamp)?.timestamp ?? null,
  }

  return createResult({
    status: errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'ready',
    summary,
    conversation,
    rawToolMessages,
    timeline,
    issues,
    warnings,
    errors,
  })
}
