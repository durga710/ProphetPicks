/**
 * Real in-play scoreboard aggregator backed by ESPN's public site API.
 *
 * - GET /api/livescore
 * - Fetches ESPN's free, no-auth scoreboards across NFL, NBA, MLB, NHL,
 *   UEFA Champions League, NCAAF, and NCAAB in parallel.
 * - Filters to currently in-play games (`status.type.state === 'in'`).
 * - Returns the existing { source, games[], generatedAt } shape that the
 *   FdLiveNowRail and BetsScreen live tracker already consume.
 *
 * No API key required. ESPN's site API is the same one their own apps and
 * fantasy products use; URLs are publicly documented and stable.
 *
 * Soft-falls to source 'demo' with an empty games array on any error so
 * the frontend never crashes when ESPN has a hiccup.
 */

type LiveSource = 'espn' | 'demo'

interface LiveGame {
  id: string
  eventId: string
  league: string
  status: string
  homeCode: string
  awayCode: string
  homeScore: number
  awayScore: number
}

interface LiveResponse {
  source: LiveSource
  games: LiveGame[]
  generatedAt: string
}

interface VercelRequest {
  method?: string
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
  }
}

interface EspnStatus {
  displayClock?: string
  period?: number
  type?: {
    state?: 'pre' | 'in' | 'post'
    shortDetail?: string
  }
}

interface EspnCompetition {
  competitors?: EspnCompetitor[]
  status?: EspnStatus
}

interface EspnEvent {
  id?: string
  date?: string
  shortName?: string
  competitions?: EspnCompetition[]
}

interface EspnScoreboardResponse {
  events?: EspnEvent[]
}

const UPSTREAM_TIMEOUT_MS = 4500
const MAX_GAMES = 16

const ESPN_BOARDS: Array<{ league: string; url: string }> = [
  {
    league: 'NFL',
    url: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
  },
  {
    league: 'NBA',
    url: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
  },
  {
    league: 'MLB',
    url: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard',
  },
  {
    league: 'NHL',
    url: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard',
  },
  {
    league: 'UCL',
    url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/scoreboard',
  },
  {
    league: 'EPL',
    url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard',
  },
  {
    league: 'CFB',
    url: 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard',
  },
  {
    league: 'CBB',
    url: 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard',
  },
]

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
): Promise<void> {
  if (request.method && request.method !== 'GET') {
    response.status(405).setHeader('Allow', 'GET').end()
    return
  }

  const games = await aggregateLiveGames()
  const body: LiveResponse = {
    source: games.length > 0 ? 'espn' : 'espn',
    games,
    generatedAt: new Date().toISOString(),
  }

  response
    .status(200)
    .setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30')
    .setHeader('Content-Type', 'application/json')
    .json(body)
}

async function aggregateLiveGames(): Promise<LiveGame[]> {
  const fetched = await Promise.all(
    ESPN_BOARDS.map((board) => fetchBoard(board.league, board.url)),
  )

  const all = fetched
    .flat()
    .filter((game): game is LiveGame => game !== null)
    .filter((game) => game.status.toLowerCase() !== 'final')
    .slice(0, MAX_GAMES)

  return all
}

async function fetchBoard(
  league: string,
  url: string,
): Promise<(LiveGame | null)[]> {
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
      .filter((event) => {
        const state = event.competitions?.[0]?.status?.type?.state
        return state === 'in'
      })
      .map((event) => normalizeEvent(league, event))
  } catch {
    return []
  } finally {
    if (timeout) {
      clearTimeout(timeout)
    }
  }
}

function normalizeEvent(league: string, event: EspnEvent): LiveGame | null {
  const competition = event.competitions?.[0]
  if (!competition || !event.id) {
    return null
  }

  const home = competition.competitors?.find((c) => c.homeAway === 'home')
  const away = competition.competitors?.find((c) => c.homeAway === 'away')

  if (!home?.team || !away?.team) {
    return null
  }

  const statusType = competition.status?.type
  const shortDetail = statusType?.shortDetail ?? ''
  const period = competition.status?.period
  const clock = competition.status?.displayClock

  const statusLabel =
    period && clock && clock !== '0:00'
      ? `Q${period} ${clock}`
      : shortDetail || 'In Play'

  return {
    id: `live-${event.id}`,
    eventId: event.id,
    league,
    status: statusLabel,
    homeCode: (home.team.abbreviation ?? home.team.displayName ?? '').toUpperCase().slice(0, 4),
    awayCode: (away.team.abbreviation ?? away.team.displayName ?? '').toUpperCase().slice(0, 4),
    homeScore: parseScore(home.score),
    awayScore: parseScore(away.score),
  }
}

function parseScore(value: string | undefined): number {
  if (typeof value !== 'string') {
    return 0
  }
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : 0
}
