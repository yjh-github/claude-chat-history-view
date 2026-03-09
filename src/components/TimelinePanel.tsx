import type { AnalysisIssue, TimelineEvent } from '../types'

interface TimelinePanelProps {
  timeline: TimelineEvent[]
  issues: AnalysisIssue[]
}

function getEventTone(event: TimelineEvent): string {
  if (event.level === 'error') {
    return 'error'
  }

  if (event.level === 'warning') {
    return 'warning'
  }

  return 'info'
}

export function TimelinePanel({ timeline, issues }: TimelinePanelProps) {
  return (
    <section className="panel column-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Timeline</p>
          <h2>事件时间线</h2>
        </div>
        <span className="panel-count">{timeline.length}</span>
      </div>

      <div className="panel-section">
        {timeline.length === 0 ? (
          <div className="panel-placeholder">暂无可展示的时间线事件。</div>
        ) : (
          <ul className="timeline-list">
            {timeline.map((event) => (
              <li key={event.id} className={`timeline-item tone-${getEventTone(event)}`}>
                <div className="timeline-item-header">
                  <strong>{event.label}</strong>
                  <span>{event.timestamp ?? '无时间戳'}</span>
                </div>
                <div className="timeline-item-meta">
                  <span>{event.kind}</span>
                  {event.messageId ? <span>message: {event.messageId}</span> : null}
                </div>
                {event.detail ? <p>{event.detail}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="panel-section panel-section-divider">
        <div className="subsection-heading">
          <h3>问题列表</h3>
          <span>{issues.length}</span>
        </div>
        {issues.length === 0 ? (
          <div className="panel-placeholder">暂无问题。</div>
        ) : (
          <ul className="issue-list">
            {issues.map((issue) => (
              <li key={`${issue.severity}-${issue.code}-${issue.message}`} className={`issue-item tone-${issue.severity}`}>
                <div className="issue-item-header">
                  <strong>{issue.code}</strong>
                  <span>{issue.severity}</span>
                </div>
                <p>{issue.message}</p>
                {issue.path || issue.line ? (
                  <small>
                    {issue.path ?? 'unknown path'}
                    {issue.line ? `:${issue.line}` : ''}
                  </small>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
