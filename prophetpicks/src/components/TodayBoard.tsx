import { Eye, Plus, Search } from 'lucide-react'
import {
  americanToImpliedProbability,
  formatAmericanOdds,
  formatEdge,
  formatProbability,
} from '../domain/odds'
import type { PropLeg } from '../types'

interface TodayBoardProps {
  legs: PropLeg[]
  selectedIds: Set<string>
  activeLegId: string
  query: string
  sportFilter: string
  marketFilter: string
  onQueryChange: (query: string) => void
  onSportFilterChange: (sport: string) => void
  onMarketFilterChange: (market: string) => void
  onAddLeg: (leg: PropLeg) => void
  onInspectLeg: (leg: PropLeg) => void
}

export function TodayBoard({
  legs,
  selectedIds,
  activeLegId,
  query,
  sportFilter,
  marketFilter,
  onQueryChange,
  onSportFilterChange,
  onMarketFilterChange,
  onAddLeg,
  onInspectLeg,
}: TodayBoardProps) {
  const sports = Array.from(new Set(legs.map((leg) => leg.sport)))
  const sportLegs = legs.filter(
    (leg) => sportFilter === 'All sports' || leg.sport === sportFilter,
  )
  const markets = Array.from(new Set(sportLegs.map((leg) => leg.marketLabel)))
  const boardEyebrow =
    sportFilter === 'Soccer'
      ? 'API-Football soccer'
      : sportFilter === 'Basketball'
        ? 'NBA props'
        : 'Multi-sport slate'
  const filteredLegs = sportLegs.filter((leg) => {
    const searchText =
      `${leg.subjectName} ${leg.selectionLabel} ${leg.matchup} ${leg.marketLabel}`
      .toLowerCase()
      .trim()
    const matchesQuery = searchText.includes(query.toLowerCase().trim())
    const matchesMarket =
      marketFilter === 'All markets' || leg.marketLabel === marketFilter

    return matchesQuery && matchesMarket
  })

  return (
    <section className="board-panel today-board" aria-labelledby="today-board">
      <div className="panel-header">
        <div>
          <p className="eyebrow">{boardEyebrow}</p>
          <h2 id="today-board">Today Board</h2>
        </div>
        <div className="data-freshness">
          <span className="pulse-dot" aria-hidden="true" />
          Fixture snapshot
        </div>
      </div>

      <div className="board-tools" aria-label="Board filters">
        <label className="search-control">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">Search board</span>
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search player, team, or matchup"
          />
        </label>
        <div
          className="segmented-control sport-control"
          role="group"
          aria-label="Sport filters"
        >
          {['All sports', ...sports].map((sport) => (
            <button
              className={sportFilter === sport ? 'is-active' : ''}
              key={sport}
              type="button"
              onClick={() => onSportFilterChange(sport)}
            >
              {sport}
            </button>
          ))}
        </div>
        <div
          className="segmented-control market-control"
          role="group"
          aria-label="Market filters"
        >
          {['All markets', ...markets].map((market) => (
            <button
              className={marketFilter === market ? 'is-active' : ''}
              key={market}
              type="button"
              onClick={() => onMarketFilterChange(market)}
            >
              {market}
            </button>
          ))}
        </div>
      </div>

      <div className="table-shell">
        <table>
          <thead>
            <tr>
              <th scope="col">Leg</th>
              <th scope="col">Odds</th>
              <th scope="col">Implied</th>
              <th scope="col">Fair</th>
              <th scope="col">Edge</th>
              <th scope="col">Conf.</th>
              <th scope="col">Fresh</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredLegs.map((leg) => {
              const implied = americanToImpliedProbability(leg.americanOdds)
              const edge = leg.fairProbability - implied
              const selected = selectedIds.has(leg.id)

              return (
                <tr
                  className={activeLegId === leg.id ? 'is-focused' : ''}
                  key={leg.id}
                >
                  <td>
                    <button
                      className="leg-title-button"
                      type="button"
                      onClick={() => onInspectLeg(leg)}
                    >
                      <span className="leg-player">{leg.subjectName}</span>
                      <span className="leg-subline">
                        {leg.sport} · {leg.league} · {leg.selectionLabel} ·{' '}
                        {leg.matchup}
                      </span>
                    </button>
                  </td>
                  <td className="metric-cell">
                    {formatAmericanOdds(leg.americanOdds)}
                  </td>
                  <td>{formatProbability(implied)}</td>
                  <td>{formatProbability(leg.fairProbability)}</td>
                  <td>
                    <span className={edge >= 0 ? 'edge positive' : 'edge'}>
                      {formatEdge(edge)}
                    </span>
                  </td>
                  <td>
                    <span className={`confidence confidence-${leg.confidence}`}>
                      {leg.confidence}
                    </span>
                  </td>
                  <td>{leg.oddsUpdatedAt.slice(11, 16)}</td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="icon-button"
                        type="button"
                        aria-label={`Inspect ${leg.selectionLabel}`}
                        onClick={() => onInspectLeg(leg)}
                      >
                        <Eye size={16} aria-hidden="true" />
                      </button>
                      <button
                        className="icon-button add"
                        type="button"
                        aria-label={`Add ${leg.selectionLabel}`}
                        onClick={() => onAddLeg(leg)}
                        disabled={selected}
                      >
                        <Plus size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
