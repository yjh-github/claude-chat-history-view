import type { ConversationMessage, ConversationPart } from '../types'

interface ConversationPanelProps {
  messages: ConversationMessage[]
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

export function ConversationPanel({ messages }: ConversationPanelProps) {
  return (
    <section className="panel column-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Conversation</p>
          <h2>消息视图</h2>
        </div>
        <span className="panel-count">{messages.length}</span>
      </div>

      {messages.length === 0 ? (
        <div className="panel-placeholder">暂无可展示的消息。</div>
      ) : (
        <ul className="message-list">
          {messages.map((message) => (
            <li key={message.id} className={`message-card role-${message.role}`}>
              <div className="message-card-header">
                <strong>{message.role}</strong>
                <span>{message.createdAt ?? '无时间戳'}</span>
              </div>

              <div className="message-parts">
                {message.parts.length === 0 ? (
                  <div className="message-part">[无内容]</div>
                ) : (
                  message.parts.map((part) => (
                    <div key={part.id} className={`message-part part-${part.kind}`}>
                      <span className="part-kind">{part.kind}</span>
                      <p>{renderPartLabel(part)}</p>
                    </div>
                  ))
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
