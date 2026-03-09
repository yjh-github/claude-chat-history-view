import type { InputMode } from '../types'

interface InputPanelProps {
  sourceText: string
  detectedMode: InputMode
  canAnalyze: boolean
  onSourceChange: (value: string) => void
  onAnalyze: () => void
  onReset: () => void
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

export function InputPanel({ sourceText, detectedMode, canAnalyze, onSourceChange, onAnalyze, onReset }: InputPanelProps) {
  return (
    <section className="panel input-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Input</p>
          <h2>输入区</h2>
        </div>
        <span className={`mode-badge mode-${detectedMode}`}>Detected: {modeLabel(detectedMode)}</span>
      </div>

      <label className="field-label" htmlFor="sourceText">
        粘贴 dialogue JSON 或 SSE 文本
      </label>
      <textarea
        id="sourceText"
        value={sourceText}
        onChange={(event) => onSourceChange(event.target.value)}
        placeholder="将抓包得到的 dialogue.json 或 SSE 文本直接粘贴到这里。"
        rows={12}
        spellCheck={false}
      />

      <div className="button-row">
        <button type="button" onClick={onAnalyze} disabled={!canAnalyze}>
          分析
        </button>
        <button type="button" className="button-secondary" onClick={onReset}>
          清空
        </button>
      </div>
    </section>
  )
}
