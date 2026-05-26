import { AlertTriangle, Clock3, Gauge } from 'lucide-react'
import {
  americanToImpliedProbability,
  formatAmericanOdds,
  formatEdge,
  formatProbability,
} from '../domain/odds'
import type { PropLeg } from '../types'

interface LegDetailDrawerProps {
  leg: PropLeg
}

export function LegDetailDrawer({ leg }: LegDetailDrawerProps) {
  const implied = americanToImpliedProbability(leg.americanOdds)
  const edge = leg.fairProbability - implied

  return (
    <aside className="board-panel detail-drawer" aria-labelledby="leg-detail">
      <div className="panel-header compact-header">
        <div>
          <p className="eyebrow">Leg detail</p>
          <h2 id="leg-detail">{leg.subjectName}</h2>
        </div>
        <span className={`confidence confidence-${leg.confidence}`}>
          {leg.confidence}
        </span>
      </div>

      <div className="selection-card">
        <span>{leg.marketLabel}</span>
        <strong>{leg.line}</strong>
        <small>
          {leg.sport} · {leg.league} · {leg.matchup}
        </small>
      </div>

      <div className="detail-grid">
        <div>
          <span>Odds</span>
          <strong>{formatAmericanOdds(leg.americanOdds)}</strong>
        </div>
        <div>
          <span>Implied</span>
          <strong>{formatProbability(implied)}</strong>
        </div>
        <div>
          <span>Fair</span>
          <strong>{formatProbability(leg.fairProbability)}</strong>
        </div>
        <div>
          <span>Edge</span>
          <strong className={edge >= 0 ? 'positive-text' : ''}>
            {formatEdge(edge)}
          </strong>
        </div>
      </div>

      <div className="signal-stack">
        <h3>
          <Gauge size={16} aria-hidden="true" />
          Signals
        </h3>
        <ul>
          {leg.signals.map((signal) => (
            <li key={signal}>{signal}</li>
          ))}
        </ul>
      </div>

      <div className="risk-stack">
        <h3>
          <AlertTriangle size={16} aria-hidden="true" />
          Risk notes
        </h3>
        <ul>
          {leg.riskNotes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </div>

      <div className="freshness-strip">
        <Clock3 size={15} aria-hidden="true" />
        Updated {leg.oddsUpdatedAt.slice(11, 16)} · {leg.modelVersion}
      </div>
    </aside>
  )
}
