export type InputMode = 'dialogue' | 'sse' | 'unknown'

export type AnalysisStatus = 'idle' | 'ready' | 'warning' | 'error'

export type IssueSeverity = 'warning' | 'error'

export interface AnalysisIssue {
  code: string
  message: string
  severity: IssueSeverity
  path?: string
  line?: number
  detail?: string
}

export interface TimelineEvent {
  id: string
  kind: 'status' | 'message' | 'warning' | 'error'
  level: 'info' | 'warning' | 'error'
  label: string
  timestamp?: string
  detail?: string
  messageId?: string
  rawPayload?: string
  metadata?: Record<string, unknown>
}

export interface ConversationPart {
  id: string
  kind: 'text' | 'tool-use' | 'tool-result' | 'reasoning' | 'unknown'
  text?: string
  metadata?: Record<string, unknown>
}

export type ConversationRole = 'system' | 'user' | 'assistant' | 'tool' | 'unknown'

export interface ConversationMessage {
  id: string
  role: ConversationRole
  createdAt?: string
  parts: ConversationPart[]
  metadata?: Record<string, unknown>
}

export interface AnalysisSummary {
  messageCount: number
  eventCount: number
  warningCount: number
  errorCount: number
  startedAt: string | null
  finishedAt: string | null
}

export interface AnalysisResult {
  status: AnalysisStatus
  summary: AnalysisSummary
  conversation: ConversationMessage[]
  messages: ConversationMessage[]
  timeline: TimelineEvent[]
  issues: AnalysisIssue[]
  warnings: AnalysisIssue[]
  errors: AnalysisIssue[]
}

export interface ParsedSSEEvent {
  id: string
  event?: string
  line: number
  rawPayload: string
  data: string
  isDone: boolean
  json?: Record<string, unknown>
}

export interface ParsedSSE {
  headers: string[]
  events: ParsedSSEEvent[]
  issues: AnalysisIssue[]
}
