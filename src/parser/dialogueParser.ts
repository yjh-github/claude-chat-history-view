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

function normalizeContentParts(content: DialogueMessage['content'], messageId: string): ConversationPart[] {
  if (typeof content === 'string') {
    const text = toText(content)
    return text
      ? [
          {
            id: `${messageId}-part-0`,
            kind: 'text',
            text,
          },
        ]
      : []
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

function normalizeMessage(message: DialogueMessage, index: number): ConversationMessage {
  const messageId = `message-${index}`
  const contentParts = normalizeContentParts(message.content, messageId)
  const toolCallParts = normalizeToolCalls(message.tool_calls, messageId)
  const parts = [...contentParts, ...toolCallParts]

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

function buildTimeline(conversation: ConversationMessage[]): TimelineEvent[] {
  return conversation.map((message, index) => ({
    id: `timeline-${index}`,
    kind: 'message',
    level: message.role === 'unknown' ? 'warning' : 'info',
    label: `${message.role} 消息`,
    detail: message.parts.map((part) => part.text ?? `[${part.kind}]`).join(' ').trim() || '[empty]',
    messageId: message.id,
    timestamp: message.createdAt,
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

function createResult(result: Omit<AnalysisResult, 'messages'>): AnalysisResult {
  return {
    ...result,
    messages: result.conversation,
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
      timeline: [],
      issues: errors,
      warnings: [],
      errors,
    })
  }

  const rawMessages = Array.isArray(document.messages) ? document.messages : []
  const conversation = rawMessages.map(normalizeMessage)
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
    timeline,
    issues,
    warnings,
    errors,
  })
}
