import { Save, Trash2, TriangleAlert } from 'lucide-react'
import {
  americanToImpliedProbability,
  decimalToAmericanOdds,
  formatAmericanOdds,
  formatEdge,
  formatProbability,
} from '../domain/odds'
import { validateSlip } from '../domain/slip'
import type { PropLeg } from '../types'

interface SlipRailProps {
  now: string
  selectedLegs: PropLeg[]
  onRemoveLeg: (legId: string) => void
  onSaveSlip: () => void
}

export function SlipRail({
  now,
  selectedLegs,
  onRemoveLeg,
  onSaveSlip,
}: SlipRailProps) {
  const validation = validateSlip(
    selectedLegs.map((leg) => ({
      id: leg.id,
      eventId: leg.eventId,
      marketId: leg.marketId,
      selectionId: leg.selectionId,
      teamId: leg.teamId,
      playerId: leg.playerId,
      marketType: leg.marketType,
      oddsUpdatedAt: leg.oddsUpdatedAt,
      startsAt: leg.startsAt,
      americanOdds: leg.americanOdds,
      decimalOdds: leg.decimalOdds,
      fairProbability: leg.fairProbability,
    })),
    { now, maxLegs: 5, staleAfterMinutes: 20 },
  )
  const canSave = selectedLegs.length > 0 && validation.errors.length === 0
  const combinedAmerican =
    validation.combinedDecimalOdds > 0
      ? decimalToAmericanOdds(validation.combinedDecimalOdds)
      : 0

  return (
    <aside className="slip-rail" aria-labelledby="selected-slip">
      <div className="panel-header compact-header">
        <div>
          <p className="eyebrow">Parlay lab</p>
          <h2 id="selected-slip">Selected Slip</h2>
        </div>
        <span className="leg-count">{selectedLegs.length}/5</span>
      </div>

      <div className="slip-list">
        {selectedLegs.length === 0 ? (
          <div className="empty-slip">
            <TriangleAlert size={18} aria-hidden="true" />
            No legs selected
          </div>
        ) : (
          selectedLegs.map((leg) => {
            const implied = americanToImpliedProbability(leg.americanOdds)
            const edge = leg.fairProbability - implied

            return (
              <div className="slip-leg" key={leg.id}>
                <div>
                  <strong>{leg.selectionLabel}</strong>
                  <span>
                    {formatAmericanOdds(leg.americanOdds)} · {formatEdge(edge)}
                  </span>
                </div>
                <button
                  className="icon-button"
                  type="button"
                  aria-label={`Remove ${leg.selectionLabel}`}
                  onClick={() => onRemoveLeg(leg.id)}
                >
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              </div>
            )
          })
        )}
      </div>

      <div className="slip-metrics">
        <div>
          <span>Combined odds</span>
          <strong>
            {selectedLegs.length > 0 ? formatAmericanOdds(combinedAmerican) : '-'}
          </strong>
        </div>
        <div>
          <span>Hit estimate</span>
          <strong>{formatProbability(validation.estimatedHitProbability)}</strong>
        </div>
      </div>

      <div className="warning-list" aria-live="polite">
        {[...validation.errors, ...validation.warnings].map((warning) => (
          <div className="warning-pill" key={warning}>
            {warning}
          </div>
        ))}
      </div>

      <button
        className="save-button"
        type="button"
        onClick={onSaveSlip}
        disabled={!canSave}
      >
        <Save size={17} aria-hidden="true" />
        Save to journal
      </button>
    </aside>
  )
}
