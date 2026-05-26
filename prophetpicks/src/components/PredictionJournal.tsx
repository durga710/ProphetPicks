import { BookOpen } from 'lucide-react'
import type { JournalEntry } from '../domain/journal'
import { formatAmericanOdds, formatEdge, formatProbability } from '../domain/odds'

interface PredictionJournalProps {
  entries: JournalEntry[]
}

export function PredictionJournal({ entries }: PredictionJournalProps) {
  return (
    <section className="board-panel journal-panel" aria-labelledby="journal">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Tracking</p>
          <h2 id="journal">Journaled Slips</h2>
        </div>
        <BookOpen size={20} aria-hidden="true" />
      </div>

      {entries.length === 0 ? (
        <div className="journal-empty">No saved slips yet</div>
      ) : (
        <div className="journal-list">
          {entries.map((entry) => (
            <article className="journal-entry" key={entry.id}>
              <div className="journal-entry-header">
                <strong>{entry.note ?? 'Research slip'}</strong>
                <span>{entry.createdAt.slice(11, 16)}</span>
              </div>
              {entry.legs.map((leg) => (
                <div className="journal-leg" key={leg.id}>
                  <span>{leg.selectionLabel}</span>
                  <small>
                    {formatAmericanOdds(leg.oddsAtSelection)} · fair{' '}
                    {formatProbability(leg.fairProbability)} · edge{' '}
                    {formatEdge(leg.edge)}
                  </small>
                </div>
              ))}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
