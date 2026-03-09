import { useMemo, useState } from 'react'
import { ConversationPanel } from './components/ConversationPanel'
import { EmptyState } from './components/EmptyState'
import { InputPanel } from './components/InputPanel'
import { SummaryBar } from './components/SummaryBar'
import { TimelinePanel } from './components/TimelinePanel'
import { reconstructConversation } from './parser/chatReconstructor'
import { parseDialogue } from './parser/dialogueParser'
import { inspectInput } from './parser/inputDetector'
import { parseRawSSE } from './parser/sseParser'
import type { AnalysisIssue, AnalysisResult, AnalysisSummary, InputMode } from './types'

const emptySummary: AnalysisSummary = {
  messageCount: 0,
  eventCount: 0,
  warningCount: 0,
  errorCount: 0,
  startedAt: null,
  finishedAt: null,
}

function createAnalysisResult(
  result: Omit<AnalysisResult, 'messages' | 'conversation'> & { conversation?: AnalysisResult['conversation']; rawToolMessages?: AnalysisResult['rawToolMessages'] },
): AnalysisResult {
  const conversation = result.conversation ?? []
  const rawToolMessages = result.rawToolMessages ?? []

  return {
    ...result,
    conversation,
    messages: conversation,
    rawToolMessages,
  }
}

function buildIssueOnlyResult(issue: AnalysisIssue): AnalysisResult {
  const warnings = issue.severity === 'warning' ? [issue] : []
  const errors = issue.severity === 'error' ? [issue] : []

  return createAnalysisResult({
    status: issue.severity === 'error' ? 'error' : 'warning',
    summary: {
      ...emptySummary,
      warningCount: warnings.length,
      errorCount: errors.length,
    },
    conversation: [],
    rawToolMessages: [],
    timeline: [],
    issues: [issue],
    warnings,
    errors,
  })
}

function analyzeSource(rawSource: string): { mode: InputMode; result: AnalysisResult } {
  const inspected = inspectInput(rawSource)

  if (inspected.validationIssue) {
    return {
      mode: inspected.mode,
      result: buildIssueOnlyResult(inspected.validationIssue),
    }
  }

  if (inspected.mode === 'dialogue') {
    return {
      mode: inspected.mode,
      result: parseDialogue(inspected.normalized),
    }
  }

  const parsedSSE = parseRawSSE(inspected.normalized)
  return {
    mode: inspected.mode,
    result: reconstructConversation(parsedSSE.events, parsedSSE.issues),
  }
}

const idleResult = createAnalysisResult({
  status: 'idle',
  summary: emptySummary,
  conversation: [],
  rawToolMessages: [],
  timeline: [],
  issues: [],
  warnings: [],
  errors: [],
})

function App() {
  const [inputMode, setInputMode] = useState<InputMode>('unknown')
  const [sourceText, setSourceText] = useState('')
  const [analysis, setAnalysis] = useState<AnalysisResult>(idleResult)

  const detectedMode = useMemo(() => inspectInput(sourceText).mode, [sourceText])
  const hasSourceText = sourceText.trim().length > 0
  const shouldShowResults = useMemo(() => {
    return analysis.timeline.length > 0 || analysis.conversation.length > 0 || analysis.issues.length > 0
  }, [analysis])

  const handleReset = () => {
    setSourceText('')
    setInputMode('unknown')
    setAnalysis(idleResult)
  }

  const handleAnalyze = () => {
    const { mode, result } = analyzeSource(sourceText)
    setInputMode(mode)
    setAnalysis(result)
  }

  return (
    <main className="app-shell">
      <section className="app-layout">
        <header className="app-header">
          <div>
            <p className="eyebrow">Analyzer UI</p>
            <h1>Claude 聊天抓包分析工具</h1>
            <p className="app-description">支持 dialogue 与 SSE 两条解析路径，面向调试和结构化排查。</p>
          </div>
        </header>

        <InputPanel
          sourceText={sourceText}
          detectedMode={detectedMode}
          canAnalyze={true}
          onSourceChange={setSourceText}
          onAnalyze={handleAnalyze}
          onReset={handleReset}
        />

        <SummaryBar analysis={analysis} summary={analysis.summary} inputMode={inputMode} hasSourceText={hasSourceText} />

        {shouldShowResults ? (
          <section className="workspace-grid">
            <TimelinePanel timeline={analysis.timeline} issues={analysis.issues} />
            <ConversationPanel messages={analysis.conversation} rawToolMessages={analysis.rawToolMessages} />
          </section>
        ) : (
          <EmptyState hasSourceText={hasSourceText} inputMode={inputMode} />
        )}
      </section>
    </main>
  )
}

export default App
