import {
  decimalToAmericanOdds,
  decimalToImpliedProbability,
} from '../../domain/odds'
import type { PropLeg, MarketType } from '../../types'

export const API_FOOTBALL_BASE_URL = 'https://v3.football.api-sports.io'

export type ApiFootballEndpoint = '/fixtures' | '/odds'
export type ApiFootballQuery = Record<
  string,
  string | number | boolean | undefined
>

export interface ApiFootballTeam {
  id: number
  name: string
}

export interface ApiFootballFixtureResponseItem {
  fixture: {
    id: number
    date: string
    timestamp?: number
    status?: {
      short?: string
      long?: string
    }
  }
  league: {
    id: number
    name: string
    country?: string
    season?: number
    round?: string
  }
  teams: {
    home: ApiFootballTeam
    away: ApiFootballTeam
  }
}

export interface ApiFootballOddsValue {
  value: string
  odd: string
}

export interface ApiFootballOddsBet {
  id: number
  name: string
  values: ApiFootballOddsValue[]
}

export interface ApiFootballOddsBookmaker {
  id: number
  name: string
  bets: ApiFootballOddsBet[]
}

export interface ApiFootballOddsResponseItem {
  fixture: {
    id: number
    date: string
  }
  update?: string
  bookmakers: ApiFootballOddsBookmaker[]
}

export interface SoccerTeam {
  id: string
  providerTeamId: number
  name: string
}

export interface NormalizedSoccerFixture {
  id: string
  sport: 'Soccer'
  provider: 'api-football'
  providerFixtureId: number
  providerLeagueId: number
  league: string
  matchup: string
  startsAt: string
  homeTeam: SoccerTeam
  awayTeam: SoccerTeam
  status: string
  statusLabel: string
  season?: number
  round?: string
}

export interface NormalizeApiFootballOddsOptions {
  now?: string
  modelVersion?: string
  fairProbabilities?: Record<string, number>
}

interface MarketMapping {
  marketType: MarketType
  marketLabel: string
}

export function buildApiFootballUrl(
  endpoint: ApiFootballEndpoint,
  query: ApiFootballQuery = {},
): string {
  const url = new URL(endpoint, API_FOOTBALL_BASE_URL)

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined) {
      url.searchParams.set(key, String(value))
    }
  })

  return url.toString()
}

export function normalizeApiFootballFixture(
  item: ApiFootballFixtureResponseItem,
): NormalizedSoccerFixture {
  const startsAt = normalizeIsoDate(item.fixture.date)
  const homeTeam = toSoccerTeam(item.teams.home)
  const awayTeam = toSoccerTeam(item.teams.away)

  return {
    id: `api-football:fixture:${item.fixture.id}`,
    sport: 'Soccer',
    provider: 'api-football',
    providerFixtureId: item.fixture.id,
    providerLeagueId: item.league.id,
    league: item.league.name,
    matchup: `${homeTeam.name} vs ${awayTeam.name}`,
    startsAt,
    homeTeam,
    awayTeam,
    status: item.fixture.status?.short ?? 'TBD',
    statusLabel: item.fixture.status?.long ?? 'Time TBD',
    season: item.league.season,
    round: item.league.round,
  }
}

export function normalizeApiFootballOddsToLegs(
  item: ApiFootballOddsResponseItem,
  fixture: NormalizedSoccerFixture,
  options: NormalizeApiFootballOddsOptions = {},
): PropLeg[] {
  const oddsUpdatedAt = normalizeIsoDate(
    item.update ?? options.now ?? fixture.startsAt,
  )
  const modelVersion = options.modelVersion ?? 'soccer-rules-v1'
  const legs: PropLeg[] = []

  for (const bookmaker of item.bookmakers) {
    for (const bet of bookmaker.bets) {
      const market = resolveMarket(bet)

      if (!market) {
        continue
      }

      for (const value of bet.values) {
        const leg = toPropLeg({
          fixture,
          bookmaker,
          bet,
          value,
          market,
          oddsUpdatedAt,
          modelVersion,
          fairProbabilities: options.fairProbabilities ?? {},
        })

        if (leg) {
          legs.push(leg)
        }
      }
    }
  }

  return legs
}

function toPropLeg({
  fixture,
  bookmaker,
  bet,
  value,
  market,
  oddsUpdatedAt,
  modelVersion,
  fairProbabilities,
}: {
  fixture: NormalizedSoccerFixture
  bookmaker: ApiFootballOddsBookmaker
  bet: ApiFootballOddsBet
  value: ApiFootballOddsValue
  market: MarketMapping
  oddsUpdatedAt: string
  modelVersion: string
  fairProbabilities: Record<string, number>
}): PropLeg | null {
  const selection = resolveSelection(value.value, market.marketType, fixture)
  const decimalOdds = Number(value.odd)

  if (!selection || !Number.isFinite(decimalOdds) || decimalOdds <= 1) {
    return null
  }

  const id = `${fixture.id}:${market.marketType}:${selection.key}`
  const impliedProbability = decimalToImpliedProbability(decimalOdds)
  const fairProbability = fairProbabilities[id] ?? impliedProbability
  const edge = fairProbability - impliedProbability

  return {
    id,
    sport: fixture.sport,
    league: fixture.league,
    eventId: fixture.id,
    matchup: fixture.matchup,
    startsAt: fixture.startsAt,
    teamId: selection.teamId,
    opponentId: selection.opponentId,
    subjectName: selection.subjectName,
    marketId: `${fixture.id}:${market.marketType}`,
    marketType: market.marketType,
    marketLabel: market.marketLabel,
    selectionId: id,
    selectionLabel: selection.selectionLabel,
    line: selection.line,
    americanOdds: decimalToAmericanOdds(decimalOdds),
    decimalOdds,
    fairProbability,
    confidence: edge >= 0.04 ? 'A' : edge >= 0.02 ? 'B' : 'C',
    source: `API-Football: ${bookmaker.name}`,
    oddsUpdatedAt,
    modelVersion,
    signals: [
      `${market.marketLabel} normalized from API-Football bet ${bet.id}`,
      `${bookmaker.name} decimal price ${decimalOdds.toFixed(2)}`,
      `Fixture status ${fixture.statusLabel}`,
    ],
    riskNotes: [
      'Confirm bookmaker availability before using this leg',
      'Refresh soccer odds after lineup news or late status changes',
    ],
  }
}

function normalizeIsoDate(value: string): string {
  const timestamp = new Date(value).getTime()

  if (!Number.isFinite(timestamp)) {
    throw new Error(`Invalid API-Football date: ${value}`)
  }

  return new Date(timestamp).toISOString()
}

function resolveMarket(bet: ApiFootballOddsBet): MarketMapping | null {
  const name = bet.name.toLowerCase()

  if (bet.id === 1 || name.includes('match winner')) {
    return {
      marketType: 'match_result',
      marketLabel: 'Match Result',
    }
  }

  if (name.includes('over/under')) {
    return {
      marketType: 'total_goals',
      marketLabel: 'Total Goals',
    }
  }

  if (name.includes('both teams score')) {
    return {
      marketType: 'both_teams_score',
      marketLabel: 'Both Teams Score',
    }
  }

  return null
}

function resolveSelection(
  value: string,
  marketType: MarketType,
  fixture: NormalizedSoccerFixture,
):
  | {
      key: string
      subjectName: string
      selectionLabel: string
      line: string
      teamId?: string
      opponentId?: string
    }
  | null {
  const normalized = value.trim().toLowerCase()

  if (marketType === 'match_result') {
    if (['home', '1'].includes(normalized)) {
      return {
        key: 'home',
        subjectName: fixture.homeTeam.name,
        selectionLabel: `${fixture.homeTeam.name} to win`,
        line: 'Home',
        teamId: fixture.homeTeam.id,
        opponentId: fixture.awayTeam.id,
      }
    }

    if (['away', '2'].includes(normalized)) {
      return {
        key: 'away',
        subjectName: fixture.awayTeam.name,
        selectionLabel: `${fixture.awayTeam.name} to win`,
        line: 'Away',
        teamId: fixture.awayTeam.id,
        opponentId: fixture.homeTeam.id,
      }
    }

    if (['draw', 'x'].includes(normalized)) {
      return {
        key: 'draw',
        subjectName: 'Draw',
        selectionLabel: `${fixture.homeTeam.name} and ${fixture.awayTeam.name} draw`,
        line: 'Draw',
      }
    }

    return null
  }

  if (marketType === 'total_goals') {
    const key = slug(value)
    const label = `${value} goals`

    return {
      key,
      subjectName: label,
      selectionLabel: label,
      line: value,
    }
  }

  if (marketType === 'both_teams_score') {
    const key = slug(value)

    return {
      key,
      subjectName: `Both teams score ${value}`,
      selectionLabel: `Both teams to score: ${value}`,
      line: value,
    }
  }

  return null
}

function toSoccerTeam(team: ApiFootballTeam): SoccerTeam {
  return {
    id: `api-football:team:${team.id}`,
    providerTeamId: team.id,
    name: team.name,
  }
}

function slug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}
