import { americanToDecimalOdds } from '../domain/odds'
import type {
  LegacyEvent,
  LegacyMarket,
  LegacySlipItem,
  SportKey,
} from './legacyBetfair'
import type { ScheduleGame, ScheduleOdds } from './providers/persistence'

/**
 * Adapters that turn real ESPN schedule rows + their inline pickcenter odds
 * into the LegacySlipItem shape the existing slip dialog already understands.
 *
 * Synthetic event ids are prefixed `real-` so they never collide with the
 * seed events. Sport mapping covers the leagues the /api/schedule endpoint
 * proxies; anything else falls back to 'soccer' (the most permissive group
 * structure on the demo sport rail).
 */

export type RealMarketKey = 'moneyline' | 'spread' | 'total'
export type RealSelectionSide = 'home' | 'away' | 'over' | 'under'

const LEAGUE_TO_SPORT: Record<string, SportKey> = {
  NFL: 'nfl',
  NBA: 'nba',
  MLB: 'mlb',
  NHL: 'nhl',
  UCL: 'soccer',
  EPL: 'soccer',
  'UEFA Champions League': 'soccer',
  'English Premier League': 'soccer',
  'College Football': 'ncaaf',
  CFB: 'ncaaf',
  'College Basketball': 'ncaab',
  CBB: 'ncaab',
}

function leagueToSport(league: string): SportKey {
  return LEAGUE_TO_SPORT[league] ?? 'soccer'
}

export function realScheduleToLegacyEvent(game: ScheduleGame): LegacyEvent {
  const sport = leagueToSport(game.league)
  const start = new Date(game.startsAt)
  const dateLabel = Number.isFinite(start.getTime())
    ? start.toLocaleDateString([], {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : 'TBD'
  const time = Number.isFinite(start.getTime())
    ? start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : game.statusDetail || 'TBD'

  return {
    id: `real-${game.id}`,
    sport,
    sportLabel: game.league,
    league: game.league,
    group: 'Live games',
    dateLabel,
    time,
    home: game.home.name,
    homeCode: game.home.code,
    homePrimary: '#1b2630',
    homeSecondary: '#5a6675',
    homeLogoUrl: game.home.logoUrl ?? undefined,
    away: game.away.name,
    awayCode: game.away.code,
    awayPrimary: '#1b2630',
    awaySecondary: '#5a6675',
    awayLogoUrl: game.away.logoUrl ?? undefined,
    venue: game.venue ?? 'TBD',
  }
}

interface RealMarketRequest {
  game: ScheduleGame
  market: RealMarketKey
  side: RealSelectionSide
}

interface BuiltRealItem {
  item: LegacySlipItem
  marketLabel: string
  selectionLabel: string
  americanOdds: number
  decimalOdds: number
}

/**
 * Build a LegacySlipItem from a real ESPN game + one of its live lines.
 * Returns null when the requested side has no price (e.g. ML missing).
 */
export function buildRealSlipItem(
  request: RealMarketRequest,
): BuiltRealItem | null {
  const { game, market, side } = request
  const odds = game.odds
  if (!odds) {
    return null
  }

  const event = realScheduleToLegacyEvent(game)

  const detail = resolveDetail(game, odds, market, side)
  if (!detail) {
    return null
  }

  const decimal = americanToDecimalOdds(detail.americanOdds)
  const marketObject: LegacyMarket = {
    id: `real-${game.id}-${market}`,
    label: detail.marketLabel,
    selections: [
      {
        id: `real-${game.id}-${market}-${side}`,
        label: detail.selectionLabel,
        odds: decimal,
        side: 'Back',
      },
    ],
  }

  return {
    item: {
      event,
      market: marketObject,
      selection: marketObject.selections[0],
    },
    marketLabel: detail.marketLabel,
    selectionLabel: detail.selectionLabel,
    americanOdds: detail.americanOdds,
    decimalOdds: decimal,
  }
}

interface ResolvedDetail {
  marketLabel: string
  selectionLabel: string
  americanOdds: number
}

function resolveDetail(
  game: ScheduleGame,
  odds: ScheduleOdds,
  market: RealMarketKey,
  side: RealSelectionSide,
): ResolvedDetail | null {
  if (market === 'moneyline') {
    if (side === 'home') {
      const ml = odds.homeMoneyLine
      if (ml === null) return null
      return {
        marketLabel: 'Moneyline',
        selectionLabel: `${game.home.name} ML`,
        americanOdds: ml,
      }
    }
    if (side === 'away') {
      const ml = odds.awayMoneyLine
      if (ml === null) return null
      return {
        marketLabel: 'Moneyline',
        selectionLabel: `${game.away.name} ML`,
        americanOdds: ml,
      }
    }
    return null
  }

  if (market === 'spread') {
    if (odds.spread === null) return null
    if (side === 'home') {
      return {
        marketLabel: 'Spread',
        selectionLabel: `${game.home.name} ${formatPoint(odds.spread)}`,
        americanOdds: -110,
      }
    }
    if (side === 'away') {
      return {
        marketLabel: 'Spread',
        selectionLabel: `${game.away.name} ${formatPoint(-odds.spread)}`,
        americanOdds: -110,
      }
    }
    return null
  }

  if (market === 'total') {
    if (odds.total === null) return null
    if (side === 'over') {
      return {
        marketLabel: 'Total',
        selectionLabel: `Over ${odds.total}`,
        americanOdds: -110,
      }
    }
    if (side === 'under') {
      return {
        marketLabel: 'Total',
        selectionLabel: `Under ${odds.total}`,
        americanOdds: -110,
      }
    }
    return null
  }

  return null
}

function formatPoint(point: number): string {
  if (point > 0) {
    return `+${point}`
  }
  return `${point}`
}
