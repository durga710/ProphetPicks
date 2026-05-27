/**
 * Real team logo proxy backed by TheSportsDB v1.
 *
 * - GET /api/team-logo?name=Arsenal
 * - Returns { source, name, logoUrl, sport } when a badge is found,
 *   { source: 'demo', name, logoUrl: null } otherwise.
 *
 * TheSportsDB serves real, licensed team badges via their own CDN under a
 * free non-commercial tier. The shared test key `3` works for v1 without
 * signup; set SPORTSDB_API_KEY in Vercel env to use a private key with
 * higher rate limits.
 *
 * Caching: 1-hour s-maxage at the edge to stay well under TheSportsDB's
 * "no scraping" guidance even when many distinct teams are queried.
 */

type LogoSource = 'sportsdb' | 'demo'

interface LogoResponse {
  source: LogoSource
  name: string
  logoUrl: string | null
  sport: string | null
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

interface SportsDbTeam {
  strTeam?: string
  strTeamBadge?: string | null
  strSport?: string | null
}

interface SportsDbSearchResponse {
  teams?: SportsDbTeam[] | null
}

const UPSTREAM_TIMEOUT_MS = 4500

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
): Promise<void> {
  if (request.method && request.method !== 'GET') {
    response.status(405).setHeader('Allow', 'GET').end()
    return
  }

  const rawName = request.query?.name
  const name = typeof rawName === 'string' ? rawName : Array.isArray(rawName) ? rawName[0] : ''

  if (!name) {
    response.status(400).json({ error: 'Missing `name` query parameter' })
    return
  }

  const apiKey = process.env.SPORTSDB_API_KEY ?? '3'
  const body = await fetchTeamLogo(apiKey, name)

  response
    .status(200)
    .setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400')
    .setHeader('Content-Type', 'application/json')
    .json(body)
}

async function fetchTeamLogo(apiKey: string, name: string): Promise<LogoResponse> {
  const fallback: LogoResponse = {
    source: 'demo',
    name,
    logoUrl: null,
    sport: null,
  }

  const controller =
    typeof AbortController === 'function' ? new AbortController() : null
  const timeout = controller
    ? setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)
    : null

  try {
    const url = new URL(
      `https://www.thesportsdb.com/api/v1/json/${encodeURIComponent(apiKey)}/searchteams.php`,
    )
    url.searchParams.set('t', name)

    const response = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      signal: controller?.signal,
    })

    if (!response.ok) {
      return fallback
    }

    const payload = (await response.json()) as SportsDbSearchResponse

    if (!payload || !Array.isArray(payload.teams) || payload.teams.length === 0) {
      return fallback
    }

    const match =
      payload.teams.find((team) => typeof team.strTeamBadge === 'string' && team.strTeamBadge !== '') ??
      payload.teams[0]

    return {
      source: 'sportsdb',
      name: match.strTeam ?? name,
      logoUrl: match.strTeamBadge ?? null,
      sport: match.strSport ?? null,
    }
  } catch {
    return fallback
  } finally {
    if (timeout) {
      clearTimeout(timeout)
    }
  }
}
