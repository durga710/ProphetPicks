import {
  decimalToAmericanOdds,
  decimalToImpliedProbability,
} from './odds'
import {
  getMarketsForEvent,
  legacyEvents,
  type LegacyEvent,
  type LegacyMarket,
  type LegacySlipItem,
  type SportKey,
} from '../data/legacyBetfair'

export type OddsBoardSource = 'Demo book' | 'API-Football' | 'Odds API'

export type OddsBoardCategory =
  | 'moneyline'
  | 'spread'
  | 'total'
  | 'props'
  | 'futures'
  | 'other'

export interface OddsQuote {
  id: string
  eventId: string
  sport: SportKey
  sportLabel: string
  league: string
  matchup: string
  startLabel: string
  marketId: string
  marketLabel: string
  category: OddsBoardCategory
  selectionId: string
  selectionLabel: string
  decimalOdds: number
  americanOdds: number
  impliedProbability: number
  movement: number
  source: OddsBoardSource
  updatedAt: string
  slipItem: LegacySlipItem
}

export interface BuildOddsQuotesOptions {
  now?: Date
  events?: LegacyEvent[]
}

const MOVEMENT_RANGE = 9

export function categoriseMarket(market: LegacyMarket): OddsBoardCategory {
  if (['moneyline', 'match-odds', 'winner'].includes(market.id)) {
    return 'moneyline'
  }

  if (['spread', 'handicap', 'run-line', 'puck-line'].includes(market.id)) {
    return 'spread'
  }

  if (['total', 'goals-25'].includes(market.id)) {
    return 'total'
  }

  if (
    ['player-props', 'props', 'correct-score', 'to-qualify'].includes(market.id)
  ) {
    return 'props'
  }

  if (market.id === 'futures') {
    return 'futures'
  }

  return 'other'
}

export function pickSource(event: LegacyEvent, market: LegacyMarket): OddsBoardSource {
  if (event.sport === 'soccer') {
    return 'API-Football'
  }

  if (categoriseMarket(market) === 'futures') {
    return 'Odds API'
  }

  return 'Demo book'
}

export function deriveMovement(seed: string): number {
  const hash = hashSeed(seed)
  const magnitude = (hash % MOVEMENT_RANGE) + 1
  const sign = (hash >> 8) % 2 === 0 ? 1 : -1

  return sign * magnitude
}

export function formatMovement(movement: number): string {
  return movement >= 0 ? `+${movement}` : `${movement}`
}

export function buildOddsQuotes({
  now,
  events,
}: BuildOddsQuotesOptions = {}): OddsQuote[] {
  const reference = (now ?? new Date()).getTime()
  const sourceEvents = events ?? legacyEvents
  const quotes: OddsQuote[] = []

  for (const event of sourceEvents) {
    const markets = getMarketsForEvent(event)

    for (const market of markets) {
      for (const selection of market.selections) {
        const seed = `${event.id}:${market.id}:${selection.id}`
        const updatedAt = new Date(
          reference - ((hashSeed(seed) % 600) * 1000),
        ).toISOString()

        quotes.push({
          id: seed,
          eventId: event.id,
          sport: event.sport,
          sportLabel: event.sportLabel,
          league: event.league,
          matchup: `${event.home} VS ${event.away}`,
          startLabel: `${event.dateLabel} - ${event.time}`,
          marketId: market.id,
          marketLabel: market.label,
          category: categoriseMarket(market),
          selectionId: selection.id,
          selectionLabel: selection.label,
          decimalOdds: selection.odds,
          americanOdds: decimalToAmericanOdds(selection.odds),
          impliedProbability: decimalToImpliedProbability(selection.odds),
          movement: deriveMovement(seed),
          source: pickSource(event, market),
          updatedAt,
          slipItem: { event, market, selection },
        })
      }
    }
  }

  return quotes
}

export function getCategoryLabel(category: OddsBoardCategory): string {
  switch (category) {
    case 'moneyline':
      return 'Moneyline'
    case 'spread':
      return 'Spread / Handicap'
    case 'total':
      return 'Total'
    case 'props':
      return 'Props'
    case 'futures':
      return 'Futures'
    default:
      return 'Other'
  }
}

function hashSeed(seed: string): number {
  let hash = 0

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(index)
    hash |= 0
  }

  return Math.abs(hash)
}
