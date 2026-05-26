export type JournalResult = 'UNKNOWN' | 'WON' | 'LOST' | 'VOID'

export interface JournalLegInput {
  id: string
  eventId: string
  marketId: string
  selectionId: string
  selectionLabel: string
  oddsAtSelection: number
  impliedProbability: number
  fairProbability: number
  edge: number
  modelVersion: string
}

export interface JournalLeg extends JournalLegInput {
  result: JournalResult
}

export interface JournalEntryInput {
  id: string
  createdAt: string
  legs: JournalLegInput[]
  note?: string
}

export interface JournalEntry {
  id: string
  createdAt: string
  legs: JournalLeg[]
  note?: string
}

export function createJournalEntry(input: JournalEntryInput): JournalEntry {
  return {
    id: input.id,
    createdAt: input.createdAt,
    note: input.note,
    legs: input.legs.map((leg) => ({
      ...leg,
      result: 'UNKNOWN',
    })),
  }
}

export function settleJournalLeg(
  entry: JournalEntry,
  legId: string,
  result: Exclude<JournalResult, 'UNKNOWN'>,
): JournalEntry {
  return {
    ...entry,
    legs: entry.legs.map((leg) =>
      leg.id === legId
        ? {
            ...leg,
            result,
          }
        : leg,
    ),
  }
}
