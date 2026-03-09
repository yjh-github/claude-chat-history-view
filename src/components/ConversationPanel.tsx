import { useMemo, useState } from 'react'
import type { ConversationMessage, ConversationPart } from '../types'

interface ConversationPanelProps {
  messages: ConversationMessage[]
  rawToolMessages: ConversationMessage[]
}

function parseStructuredText(value: string | undefined): unknown {
  if (!value) {
    return undefined
  }

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

function formatStructuredSummary(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '空结果数组'
    }

    const firstItem = value[0]
    if (firstItem && typeof firstItem === 'object' && !Array.isArray(firstItem)) {
      const type = typeof (firstItem as Record<string, unknown>).type === 'string' ? (firstItem as Record<string, unknown>).type : undefined
      return type ? `${value.length} 项结果 · 首项类型 ${type}` : `${value.length} 项结果`
    }

    return `${value.length} 项结果`
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    const type = typeof record.type === 'string' ? record.type : undefined
    const keys = Object.keys(record)

    if (type) {
      return `对象结果 · 类型 ${type}`
    }

    return keys.length > 0 ? `对象结果 · ${keys.length} 个字段` : '空对象结果'
  }

  return undefined
}

function formatStructuredContent(value: unknown): string | undefined {
  if (value == null) {
    return undefined
  }

  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return undefined
  }
}

function renderPartLabel(part: ConversationPart): string {
  if (part.kind === 'text') {
    return part.text?.trim() ? part.text : '[空文本]'
  }

  if (part.kind === 'reasoning') {
    return part.text?.trim() ? part.text : '[reasoning]'
  }

  if (part.kind === 'tool-use') {
    return part.text?.trim() ? part.text : '[tool-use]'
  }

  if (part.kind === 'tool-result') {
    return part.text?.trim() ? part.text : '[tool-result]'
  }

  return part.text?.trim() ? part.text : `[${part.kind}]`
}

function getToolCallId(message: ConversationMessage): string | undefined {
  const metadata = message.metadata as Record<string, unknown> | undefined
  const value = metadata?.tool_call_id
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function buildMessagePreview(message: ConversationMessage): string {
  const firstNonEmptyPart = message.parts.find((part) => renderPartLabel(part).trim())

  if (!firstNonEmptyPart) {
    return '无文本内容'
  }

  const preview = renderPartLabel(firstNonEmptyPart).replace(/\s+/g, ' ').trim()

  if (!preview) {
    return '无文本内容'
  }

  return preview.length > 72 ? `${preview.slice(0, 72)}…` : preview
}

function renderPartBody(part: ConversationPart) {
  if (part.kind !== 'tool-result') {
    return <p>{renderPartLabel(part)}</p>
  }

  const structured = parseStructuredText(part.text)
  const summary = formatStructuredSummary(structured)
  const formatted = formatStructuredContent(structured)

  if (!structured || !formatted) {
    return <p>{renderPartLabel(part)}</p>
  }

  return (
    <div className="tool-result-body">
      {summary ? <p className="tool-result-summary">{summary}</p> : null}
      <pre className="tool-result-content">{formatted}</pre>
    </div>
  )
}

function MessageList({
  title,
  eyebrow,
  messages,
  compact = false,
  collapsed = false,
  collapseActionLabel = '展开',
  expandActionLabel = '收起',
  onToggleCollapsed,
}: {
  title: string
  eyebrow: string
  messages: ConversationMessage[]
  compact?: boolean
  collapsed?: boolean
  collapseActionLabel?: string
  expandActionLabel?: string
  onToggleCollapsed?: () => void
}) {
  const [expandedMessageIds, setExpandedMessageIds] = useState<Record<string, boolean>>({})

  const areAllMessagesExpanded = useMemo(() => {
    return messages.length > 0 && messages.every((message) => expandedMessageIds[message.id])
  }, [expandedMessageIds, messages])

  const toggleMessage = (messageId: string) => {
    setExpandedMessageIds((current) => ({
      ...current,
      [messageId]: !current[messageId],
    }))
  }

  const toggleAllMessages = () => {
    if (areAllMessagesExpanded) {
      setExpandedMessageIds({})
      return
    }

    setExpandedMessageIds(
      Object.fromEntries(messages.map((message) => [message.id, true])),
    )
  }

  return (
    <section className={`panel-section ${compact ? 'message-section-compact' : ''} ${collapsed ? 'message-section-collapsed' : ''}`}>
      <div className="subsection-heading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h3>{title}</h3>
        </div>
        <div className="panel-heading-actions">
          {onToggleCollapsed ? (
            <button type="button" className="button-secondary panel-action-button" onClick={onToggleCollapsed}>
              {collapsed ? collapseActionLabel : expandActionLabel}
            </button>
          ) : null}
          {!collapsed && messages.length > 0 ? (
            <button type="button" className="button-secondary panel-action-button" onClick={toggleAllMessages}>
              {areAllMessagesExpanded ? '全部收起' : '全部展开'}
            </button>
          ) : null}
          <span className="panel-count">{messages.length}</span>
        </div>
      </div>

      {collapsed ? (
        <div className="panel-placeholder">该分区已折叠，点击右上角按钮查看。</div>
      ) : messages.length === 0 ? (
        <div className="panel-placeholder">暂无可展示的消息。</div>
      ) : (
        <ul className="message-list">
          {messages.map((message) => {
            const isExpanded = expandedMessageIds[message.id] ?? false
            const preview = buildMessagePreview(message)

            return (
              <li key={message.id} className={`message-card role-${message.role} ${isExpanded ? 'message-card-expanded' : ''}`}>
                <button
                  type="button"
                  className="message-card-toggle"
                  onClick={() => toggleMessage(message.id)}
                  aria-expanded={isExpanded}
                >
                  <div className="message-card-header">
                    <strong>{message.role}</strong>
                    <span>{message.createdAt ?? '无时间戳'}</span>
                  </div>
                  <div className="message-card-summary">
                    <span>{message.parts.length} 段内容</span>
                    {message.role === 'tool' && getToolCallId(message) ? <span>tool_call_id: {getToolCallId(message)}</span> : null}
                    <span>{preview}</span>
                  </div>
                  <span className="message-card-action">
                    <span className={`message-card-chevron ${isExpanded ? 'message-card-chevron-expanded' : ''}`} aria-hidden="true">
                      ▸
                    </span>
                    <span>{isExpanded ? '收起' : '展开'}</span>
                  </span>
                </button>

                {isExpanded ? (
                  <div className="message-parts">
                    {message.parts.length === 0 ? (
                      <div className="message-part">[无内容]</div>
                    ) : (
                      message.parts.map((part) => (
                        <div key={part.id} className={`message-part part-${part.kind}`}>
                          <span className="part-kind">{part.kind}</span>
                          {renderPartBody(part)}
                        </div>
                      ))
                    )}
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export function ConversationPanel({ messages, rawToolMessages }: ConversationPanelProps) {
  const [isSystemSectionCollapsed, setIsSystemSectionCollapsed] = useState(true)
  const primaryMessages = useMemo(() => messages.filter((message) => message.role !== 'system' && message.role !== 'tool'), [messages])
  const systemMessages = useMemo(() => messages.filter((message) => message.role === 'system'), [messages])
  const toolMessages = useMemo(() => rawToolMessages, [rawToolMessages])

  return (
    <section className="panel column-panel conversation-panel-split">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Conversation</p>
          <h2>消息视图</h2>
        </div>
        <span className="panel-count">{messages.length}</span>
      </div>

      <MessageList title="主消息流" eyebrow="Primary" messages={primaryMessages} />
      {systemMessages.length > 0 ? (
        <div className="panel-section panel-section-divider panel-section-secondary">
          <MessageList
            title="System 上下文"
            eyebrow="System"
            messages={systemMessages}
            compact
            collapsed={isSystemSectionCollapsed}
            collapseActionLabel="展开上下文"
            expandActionLabel="收起上下文"
            onToggleCollapsed={() => setIsSystemSectionCollapsed((current) => !current)}
          />
        </div>
      ) : null}
      {toolMessages.length > 0 ? (
        <div className="panel-section panel-section-divider panel-section-secondary">
          <MessageList title="Tool 明细" eyebrow="Tool" messages={toolMessages} compact />
        </div>
      ) : null}
    </section>
  )
}
