import type { AnalysisResult, AnalysisSummary, InputMode } from '../types'

interface SummaryBarProps {
  analysis: AnalysisResult
  summary: AnalysisSummary
  inputMode: InputMode
  hasSourceText: boolean
}

function modeLabel(mode: InputMode): string {
  if (mode === 'dialogue') {
    return 'dialogue'
  }

  if (mode === 'sse') {
    return 'sse'
  }

  return 'unknown'
}

function formatTimeRange(summary: AnalysisSummary): string {
  if (!summary.startedAt && !summary.finishedAt) {
    return '未提供'
  }

  return `${summary.startedAt ?? '未知'} → ${summary.finishedAt ?? '未知'}`
}

export function SummaryBar({ analysis, summary, inputMode, hasSourceText }: SummaryBarProps) {
  const items = [
    { label: '模式', value: modeLabel(inputMode) },
    { label: '状态', value: analysis.status },
    { label: '来源', value: hasSourceText ? '本地粘贴' : '未导入' },
    { label: '消息', value: String(summary.messageCount) },
    { label: '事件', value: String(summary.eventCount) },
    { label: '警告', value: String(summary.warningCount) },
    { label: '错误', value: String(summary.errorCount) },
    { label: '时间范围', value: formatTimeRange(summary) },
  ]

  return (
    <section className="summary-bar panel">
      {items.map((item) => (
        <div key={item.label} className="summary-item">
          <span className="summary-label">{item.label}</span>
          <strong className="summary-value">{item.value}</strong>
        </div>
      ))}
    </section>
  )
}
