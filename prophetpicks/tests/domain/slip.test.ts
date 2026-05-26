import { describe, expect, it } from 'vitest'
import { validateSlip, type SlipLeg } from '../../src/domain/slip'

const baseLeg: SlipLeg = {
  id: 'leg_1',
  eventId: 'evt_lakers_warriors',
  marketId: 'mkt_lebron_points',
  selectionId: 'sel_lebron_over_25_5',
  teamId: 'lal',
  playerId: 'lebron-james',
  marketType: 'player_points',
  oddsUpdatedAt: '2026-05-26T16:48:00Z',
  startsAt: '2026-05-26T23:30:00Z',
  americanOdds: -110,
  decimalOdds: 1.91,
  fairProbability: 0.58,
}

describe('slip validation', () => {
  it('rejects duplicate legs', () => {
    const result = validateSlip([baseLeg, { ...baseLeg }], {
      now: '2026-05-26T16:55:00Z',
      maxLegs: 5,
    })

    expect(result.errors).toContain('Duplicate leg')
  })

  it('warns on stale odds', () => {
    const result = validateSlip([baseLeg], {
      now: '2026-05-26T17:08:01Z',
      maxLegs: 5,
      staleAfterMinutes: 20,
    })

    expect(result.warnings).toContain('Stale odds')
  })

  it('warns when too many legs are selected', () => {
    const legs = Array.from({ length: 7 }, (_, index) => ({
      ...baseLeg,
      id: `leg_${index}`,
      eventId: `evt_${index}`,
      marketId: `mkt_${index}`,
      selectionId: `sel_${index}`,
    }))

    const result = validateSlip(legs, {
      now: '2026-05-26T16:55:00Z',
      maxLegs: 5,
    })

    expect(result.warnings).toContain('Too many legs')
  })

  it('warns when selected legs are correlated by team or player', () => {
    const result = validateSlip(
      [
        baseLeg,
        {
          ...baseLeg,
          id: 'leg_2',
          marketId: 'mkt_lebron_assists',
          selectionId: 'sel_lebron_over_7_5_ast',
          marketType: 'player_assists',
        },
      ],
      { now: '2026-05-26T16:55:00Z', maxLegs: 5 },
    )

    expect(result.warnings).toContain('Correlated legs')
  })
})
