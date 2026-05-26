import { describe, expect, it } from 'vitest'
import {
  createJournalEntry,
  settleJournalLeg,
  type JournalLegInput,
} from '../../src/domain/journal'

const legInput: JournalLegInput = {
  id: 'leg_1',
  eventId: 'evt_lakers_warriors',
  marketId: 'mkt_lebron_points',
  selectionId: 'sel_lebron_over_25_5',
  selectionLabel: 'LeBron James over 25.5 points',
  oddsAtSelection: -110,
  impliedProbability: 0.5238,
  fairProbability: 0.58,
  edge: 0.0562,
  modelVersion: 'rules-v1',
}

describe('prediction journal', () => {
  it('stores a prediction snapshot when saving a slip', () => {
    const entry = createJournalEntry({
      id: 'journal_1',
      createdAt: '2026-05-26T17:10:00Z',
      legs: [legInput],
      note: 'Test slip',
    })

    expect(entry.legs[0]).toMatchObject({
      oddsAtSelection: -110,
      impliedProbability: 0.5238,
      fairProbability: 0.58,
      edge: 0.0562,
      modelVersion: 'rules-v1',
      result: 'UNKNOWN',
    })
  })

  it('settles a journal leg without mutating the original entry', () => {
    const entry = createJournalEntry({
      id: 'journal_1',
      createdAt: '2026-05-26T17:10:00Z',
      legs: [legInput],
    })

    const won = settleJournalLeg(entry, 'leg_1', 'WON')
    const lost = settleJournalLeg(entry, 'leg_1', 'LOST')
    const voided = settleJournalLeg(entry, 'leg_1', 'VOID')

    expect(entry.legs[0].result).toBe('UNKNOWN')
    expect(won.legs[0].result).toBe('WON')
    expect(lost.legs[0].result).toBe('LOST')
    expect(voided.legs[0].result).toBe('VOID')
  })
})
