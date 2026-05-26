import { useMemo, useState } from 'react'
import {
  Activity,
  BarChart3,
  Gauge,
  LayoutDashboard,
  LockKeyhole,
  ScrollText,
} from 'lucide-react'
import { BrandMark } from './components/BrandMark'
import { LegDetailDrawer } from './components/LegDetailDrawer'
import { ModelHealth } from './components/ModelHealth'
import { PredictionJournal } from './components/PredictionJournal'
import { SlipRail } from './components/SlipRail'
import { TodayBoard } from './components/TodayBoard'
import { APP_NOW, propLegs } from './data/fixtures'
import { createJournalEntry, type JournalEntry } from './domain/journal'
import {
  americanToImpliedProbability,
  calculateEdge,
  formatEdge,
} from './domain/odds'
import type { PropLeg } from './types'

function App() {
  const [selectedLegIds, setSelectedLegIds] = useState<string[]>([])
  const [activeLegId, setActiveLegId] = useState(propLegs[0].id)
  const [query, setQuery] = useState('')
  const [marketFilter, setMarketFilter] = useState('All markets')
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([])
  const [toast, setToast] = useState('')

  const selectedLegs = useMemo(
    () => propLegs.filter((leg) => selectedLegIds.includes(leg.id)),
    [selectedLegIds],
  )
  const selectedIds = useMemo(() => new Set(selectedLegIds), [selectedLegIds])
  const activeLeg =
    propLegs.find((leg) => leg.id === activeLegId) ?? propLegs[0]
  const topEdges = propLegs
    .map((leg) => {
      const implied = americanToImpliedProbability(leg.americanOdds)
      return {
        ...leg,
        edge: calculateEdge({
          fairProbability: leg.fairProbability,
          impliedProbability: implied,
        }),
      }
    })
    .sort((a, b) => b.edge - a.edge)
    .slice(0, 3)

  function addLeg(leg: PropLeg): void {
    setActiveLegId(leg.id)
    setToast('')
    setSelectedLegIds((current) =>
      current.includes(leg.id) ? current : [...current, leg.id],
    )
  }

  function removeLeg(legId: string): void {
    setSelectedLegIds((current) => current.filter((id) => id !== legId))
    setToast('')
  }

  function saveSlip(): void {
    if (selectedLegs.length === 0) {
      return
    }

    const entry = createJournalEntry({
      id: `journal_${journalEntries.length + 1}`,
      createdAt: APP_NOW,
      note: `${selectedLegs.length}-leg research slip`,
      legs: selectedLegs.map((leg) => {
        const impliedProbability = americanToImpliedProbability(leg.americanOdds)
        return {
          id: leg.id,
          eventId: leg.eventId,
          marketId: leg.marketId,
          selectionId: leg.selectionId,
          selectionLabel: leg.selectionLabel,
          oddsAtSelection: leg.americanOdds,
          impliedProbability,
          fairProbability: leg.fairProbability,
          edge: calculateEdge({
            fairProbability: leg.fairProbability,
            impliedProbability,
          }),
          modelVersion: leg.modelVersion,
        }
      }),
    })

    setJournalEntries((entries) => [entry, ...entries])
    setSelectedLegIds([])
    setToast('Slip saved')
  }

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="ProphetPicks navigation">
        <BrandMark compact />
        <nav>
          <a href="#command-center" className="nav-item active">
            <LayoutDashboard size={18} aria-hidden="true" />
            Board
          </a>
          <a href="#journal" className="nav-item">
            <ScrollText size={18} aria-hidden="true" />
            Journal
          </a>
          <a href="#model-health" className="nav-item">
            <BarChart3 size={18} aria-hidden="true" />
            Model
          </a>
        </nav>
        <div className="sidebar-lock">
          <LockKeyhole size={16} aria-hidden="true" />
          Private v1
        </div>
      </aside>

      <main className="workspace" id="command-center">
        <header className="workspace-header">
          <div>
            <BrandMark />
            <h1>ProphetPicks Command Center</h1>
          </div>
          <div className="header-stats" aria-label="Slate metrics">
            <div>
              <span>Slate</span>
              <strong>6 legs</strong>
            </div>
            <div>
              <span>Avg edge</span>
              <strong>+4.8%</strong>
            </div>
            <div>
              <span>Mode</span>
              <strong>Research</strong>
            </div>
          </div>
        </header>

        <section className="top-strip" aria-label="Top signals">
          {topEdges.map((leg) => (
            <button
              className="signal-card"
              type="button"
              key={leg.id}
              onClick={() => setActiveLegId(leg.id)}
            >
              <span>{leg.marketLabel}</span>
              <strong>{leg.playerName}</strong>
              <small>{formatEdge(leg.edge)} edge</small>
            </button>
          ))}
          <div className="signal-card static">
            <span>Guardrail</span>
            <strong>No stale locks</strong>
            <small>odds freshness visible</small>
          </div>
        </section>

        <div className="command-grid">
          <TodayBoard
            legs={propLegs}
            selectedIds={selectedIds}
            activeLegId={activeLegId}
            query={query}
            marketFilter={marketFilter}
            onQueryChange={setQuery}
            onMarketFilterChange={setMarketFilter}
            onAddLeg={addLeg}
            onInspectLeg={(leg) => setActiveLegId(leg.id)}
          />
          <LegDetailDrawer leg={activeLeg} />
          <SlipRail
            now={APP_NOW}
            selectedLegs={selectedLegs}
            onRemoveLeg={removeLeg}
            onSaveSlip={saveSlip}
          />
        </div>

        {toast && (
          <div className="toast" role="status">
            <Activity size={16} aria-hidden="true" />
            {toast}
          </div>
        )}

        <div className="lower-grid">
          <PredictionJournal entries={journalEntries} />
          <ModelHealth />
          <section className="board-panel principles" aria-labelledby="principles">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Rules</p>
                <h2 id="principles">Research Guardrails</h2>
              </div>
              <Gauge size={20} aria-hidden="true" />
            </div>
            <ul>
              <li>Every leg needs a reason.</li>
              <li>Probability first. Parlays second.</li>
              <li>Refresh stale numbers before saving.</li>
              <li>Journal the slip even when you skip the bet.</li>
            </ul>
          </section>
        </div>
      </main>
    </div>
  )
}

export default App
