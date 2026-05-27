/**
 * Real in-play scores proxy backed by TheSportsDB v1 livescore endpoint.
 *
 * - GET /api/livescore
 * - Returns { source, games, generatedAt } matching the existing /api/live
 *   shape so the frontend FdLiveNowRail consumes it without changes.
 *
 * TheSportsDB's `livescore.php` returns *every currently in-play game across
 * all leagues* — soccer, NFL, NBA, MLB, NHL, cricket, e-sports. Free public
 * key `3` works without signup; set SPORTSDB_API_KEY for a private key.
 *
 * When the upstream returns an empty list (off-season window with no live
 * games globally), the route returns games: [] and source: 'sportsdb'.
 * The frontend renders an empty Live Now rail in that case rather than
 * falling back to synthetic data.
 */

type LiveSource = 'sportsdb' | 'demo'

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

interface SportsDbLiveEvent {
  idEvent?: string
  strLeague?: string | null
  strSport?: string | null
  strStatus?: string | null
  strProgress?: string | null
  strHomeTeam?: string | null
  strAwayTeam?: string | null
  intHomeScore?: string | number | null
  intAwayScore?: string | number | null
}

interface SportsDbLivescoreResponse {
  events?: SportsDbLiveEvent[] | null
  livescore?: SportsDbLiveEvent[] | null
}

const UPSTREAM_TIMEOUT_MS = 4500
const MAX_GAMES = 12

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
): Promise<void> {
  if (request.method && request.method !== 'GET') {
    response.status(405).setHeader('Allow', 'GET').end()
    return
  }

  const apiKey = process.env.SPORTSDB_API_KEY ?? '3'
  const payload = await fetchLivescore(apiKey)

  response
    .status(200)
    .setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30')
    .setHeader('Content-Type', 'application/json')
    .json(payload)
}

async function fetchLivescore(apiKey: string): Promise<LiveResponse> {
  const controller =
    typeof AbortController === 'function' ? new AbortController() : null
  const timeout = controller
    ? setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)
    : null

  try {
    const url = `https://www.thesportsdb.com/api/v1/json/${encodeURIComponent(apiKey)}/livescore.php`

    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller?.signal,
    })

    if (!response.ok) {
      return { source: 'demo', games: [], generatedAt: new Date().toISOString() }
    }

    const data = (await response.json()) as SportsDbLivescoreResponse
    const rawEvents = data.events ?? data.livescore ?? []

    if (!Array.isArray(rawEvents)) {
      return { source: 'sportsdb', games: [], generatedAt: new Date().toISOString() }
    }

    const games: LiveGame[] = rawEvents
      .slice(0, MAX_GAMES)
      .map((event) => normalizeEvent(event))
      .filter((game): game is LiveGame => game !== null)

    return {
      source: 'sportsdb',
      games,
      generatedAt: new Date().toISOString(),
    }
  } catch {
    return { source: 'demo', games: [], generatedAt: new Date().toISOString() }
  } finally {
    if (timeout) {
      clearTimeout(timeout)
    }
  }
}

function normalizeEvent(event: SportsDbLiveEvent): LiveGame | null {
  if (!event.idEvent || !event.strHomeTeam || !event.strAwayTeam) {
    return null
  }

  return {
    id: `live-${event.idEvent}`,
    eventId: event.idEvent,
    league: trim(event.strLeague) || trim(event.strSport) || 'Live',
    status: trim(event.strProgress) || trim(event.strStatus) || 'In Play',
    homeCode: shortenTeam(event.strHomeTeam),
    awayCode: shortenTeam(event.strAwayTeam),
    homeScore: toNumber(event.intHomeScore),
    awayScore: toNumber(event.intAwayScore),
  }
}

function trim(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : ''
}

function toNumber(value: string | number | null | undefined): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function shortenTeam(value: string): string {
  const trimmed = value.trim()
  if (trimmed.length <= 4) {
    return trimmed.toUpperCase()
  }

  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) {
    return trimmed.slice(0, 3).toUpperCase()
  }

  return parts
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 4)
    .toUpperCase()
}
