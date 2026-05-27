/**
 * Real upcoming-game schedule backed by ESPN's public site API.
 *
 * - GET /api/schedule?sport=<key>
 *   key ∈ nfl | nba | mlb | nhl | soccer | ncaaf | ncaab
 * - Returns the next ~12 real upcoming games for the requested league
 *   with team names, kickoff time, venue, status detail, and team logo
 *   URLs.
 * - No API key needed.
 *
 * The same { source, games[], generatedAt } envelope shape as /api/livescore
 * so the frontend client can share the safeFetchJson plumbing.
 */

type ScheduleSource = 'espn' | 'demo'

interface ScheduleTeam {
  name: string
  code: string
  logoUrl: string | null
  score: number | null
}

interface ScheduleGame {
  id: string
  shortName: string
  longName: string
  startsAt: string
  league: string
  state: 'pre' | 'in' | 'post'
  statusDetail: string
  venue: string | null
  home: ScheduleTeam
  away: ScheduleTeam
}

interface ScheduleResponse {
  source: ScheduleSource
  sport: string
  games: ScheduleGame[]
  generatedAt: string
}

interface VercelRequest {
  method?: string
  query?: Record<string, string | string[] | undefined>
}

interface VercelResponse {
  status: (code: number) => VercelResponse
  setHeader: (name: string, value: string) => VercelResponse
  json: (body: unknown) => void
  end: () => void
}

interface EspnCompetitor {
  homeAway?: 'home' | 'away'
  score?: string
  team?: {
    displayName?: string
    abbreviation?: string
    logo?: string
  }
}

interface EspnStatus {
  type?: {
    state?: 'pre' | 'in' | 'post'
    shortDetail?: string
  }
}

interface EspnVenue {
  fullName?: string
}

interface EspnCompetition {
  competitors?: EspnCompetitor[]
  status?: EspnStatus
  venue?: EspnVenue
}

interface EspnEvent {
  id?: string
  date?: string
  name?: string
  shortName?: string
  competitions?: EspnCompetition[]
}

interface EspnScoreboardResponse {
  events?: EspnEvent[]
}

const UPSTREAM_TIMEOUT_MS = 4500
const MAX_GAMES = 12

const SPORT_ENDPOINTS: Record<string, { url: string; leagueLabel: string }> = {
  nfl: {
    url: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
    leagueLabel: 'NFL',
  },
  nba: {
    url: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
    leagueLabel: 'NBA',
  },
  mlb: {
    url: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard',
    leagueLabel: 'MLB',
  },
  nhl: {
    url: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard',
    leagueLabel: 'NHL',
  },
  soccer: {
    url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/scoreboard',
    leagueLabel: 'UEFA Champions League',
  },
  ncaaf: {
    url: 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard',
    leagueLabel: 'College Football',
  },
  ncaab: {
    url: 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard',
    leagueLabel: 'College Basketball',
  },
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
): Promise<void> {
  if (request.method && request.method !== 'GET') {
    response.status(405).setHeader('Allow', 'GET').end()
    return
  }

  const rawSport = request.query?.sport
  const sport =
    typeof rawSport === 'string'
      ? rawSport
      : Array.isArray(rawSport)
        ? rawSport[0]
        : ''

  if (!sport) {
    response.status(400).json({ error: 'Missing `sport` query parameter' })
    return
  }

  const config = SPORT_ENDPOINTS[sport.toLowerCase()]
  if (!config) {
    response
      .status(200)
      .setHeader('Cache-Control', 's-maxage=300')
      .setHeader('Content-Type', 'application/json')
      .json({
        source: 'demo',
        sport,
        games: [],
        generatedAt: new Date().toISOString(),
      })
    return
  }

  const games = await fetchSchedule(config.url, config.leagueLabel)

  const body: ScheduleResponse = {
    source: 'espn',
    sport,
    games,
    generatedAt: new Date().toISOString(),
  }

  response
    .status(200)
    .setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300')
    .setHeader('Content-Type', 'application/json')
    .json(body)
}

async function fetchSchedule(url: string, leagueLabel: string): Promise<ScheduleGame[]> {
  const controller =
    typeof AbortController === 'function' ? new AbortController() : null
  const timeout = controller
    ? setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)
    : null

  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller?.signal,
    })

    if (!response.ok) {
      return []
    }

    const payload = (await response.json()) as EspnScoreboardResponse
    const events = payload.events ?? []

    return events
      .map((event) => normalizeEvent(leagueLabel, event))
      .filter((game): game is ScheduleGame => game !== null)
      .slice(0, MAX_GAMES)
  } catch {
    return []
  } finally {
    if (timeout) {
      clearTimeout(timeout)
    }
  }
}

function normalizeEvent(leagueLabel: string, event: EspnEvent): ScheduleGame | null {
  const competition = event.competitions?.[0]
  if (!competition || !event.id || !event.date) {
    return null
  }

  const home = competition.competitors?.find((c) => c.homeAway === 'home')
  const away = competition.competitors?.find((c) => c.homeAway === 'away')
  if (!home?.team || !away?.team) {
    return null
  }

  const state = competition.status?.type?.state ?? 'pre'
  const statusDetail = competition.status?.type?.shortDetail ?? ''

  return {
    id: event.id,
    shortName: event.shortName ?? event.name ?? `${away.team.displayName} @ ${home.team.displayName}`,
    longName: event.name ?? `${away.team.displayName} at ${home.team.displayName}`,
    startsAt: event.date,
    league: leagueLabel,
    state,
    statusDetail,
    venue: competition.venue?.fullName ?? null,
    home: toTeam(home),
    away: toTeam(away),
  }
}

function toTeam(c: EspnCompetitor): ScheduleTeam {
  return {
    name: c.team?.displayName ?? '',
    code: (c.team?.abbreviation ?? c.team?.displayName ?? '').toUpperCase().slice(0, 4),
    logoUrl: c.team?.logo ?? null,
    score: parseScore(c.score),
  }
}

function parseScore(value: string | undefined): number | null {
  if (typeof value !== 'string') {
    return null
  }
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : null
}
