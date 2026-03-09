import type { InputMode } from '../types'

interface EmptyStateProps {
  hasSourceText: boolean
  inputMode: InputMode
}

function getMessage(hasSourceText: boolean, inputMode: InputMode): { title: string; description: string } {
  if (!hasSourceText) {
    return {
      title: '等待输入',
      description: '请先在上方输入区粘贴 dialogue.json 或 SSE 文本，然后点击“分析”。',
    }
  }

  if (inputMode === 'unknown') {
    return {
      title: '无法识别输入类型',
      description: '当前内容不符合 dialogue 或 SSE 的识别规则，请检查原始抓包内容是否完整。',
    }
  }

  return {
    title: '暂无分析结果',
    description: '已识别输入类型，但暂时没有可显示的事件或消息。',
  }
}

export function EmptyState({ hasSourceText, inputMode }: EmptyStateProps) {
  const message = getMessage(hasSourceText, inputMode)

  return (
    <section className="panel empty-state">
      <p className="eyebrow">Empty State</p>
      <h2>{message.title}</h2>
      <p>{message.description}</p>
    </section>
  )
}
