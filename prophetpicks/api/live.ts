/**
 * Vercel serverless route for ProphetPicks live game state.
 *
 * - GET /api/live -> { source, games, generatedAt }
 *
 * Returns the deterministic-ish current state of demo in-play games so the
 * frontend Live Now rail can reconcile its locally-ticking state with a
 * server-authoritative checkpoint every minute or so.
 *
 * `source: 'demo'` until a live scores provider is wired (e.g. SportRadar,
 * Stats Perform, or The Odds API live odds endpoint). Schedule is keyed off
 * the current timestamp so different deployments still see consistent state
 * within the same minute.
 */

type LiveSource = 'demo' | 'sportradar' | 'odds-api'

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

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
): Promise<void> {
  if (request.method && request.method !== 'GET') {
    response.status(405).setHeader('Allow', 'GET').end()
    return
  }

  const minute = Math.floor(Date.now() / 60000)
  const source: LiveSource = process.env.SPORTRADAR_API_KEY
    ? 'sportradar'
    : process.env.ODDS_API_KEY
      ? 'odds-api'
      : 'demo'

  const games: LiveGame[] = [
    {
      id: 'live-chiefs',
      eventId: 'chiefs-bills',
      league: 'NFL',
      status: tickClock('Q3 08:24', minute % 6),
      homeCode: 'KC',
      awayCode: 'BUF',
      homeScore: 17 + (minute % 3),
      awayScore: 14 + ((minute + 1) % 2),
    },
    {
      id: 'live-lakers',
      eventId: 'lakers-celtics',
      league: 'NBA',
      status: tickClock('Q2 04:12', minute % 6),
      homeCode: 'LAL',
      awayCode: 'BOS',
      homeScore: 52 + (minute % 4),
      awayScore: 49 + ((minute + 2) % 3),
    },
    {
      id: 'live-arsenal',
      eventId: 'arsenal-barcelona',
      league: 'UCL',
      status: `${65 + (minute % 5)}'`,
      homeCode: 'ARS',
      awayCode: 'BAR',
      homeScore: 1,
      awayScore: 1,
    },
    {
      id: 'live-leafs',
      eventId: 'leafs-bruins',
      league: 'NHL',
      status: tickClock('P2 12:08', minute % 4),
      homeCode: 'TOR',
      awayCode: 'BOS',
      homeScore: 2 + (minute % 2),
      awayScore: 1,
    },
  ]

  const payload: LiveResponse = {
    source,
    games,
    generatedAt: new Date().toISOString(),
  }

  response
    .status(200)
    .setHeader('Cache-Control', 'no-store')
    .setHeader('Content-Type', 'application/json')
    .json(payload)
}

function tickClock(seed: string, ticks: number): string {
  const match = seed.match(/^(Q|P)(\d)\s+(\d{2}):(\d{2})$/)
  if (!match) {
    return seed
  }

  const [, prefix, periodRaw, minutesRaw, secondsRaw] = match
  let totalSeconds =
    Number.parseInt(minutesRaw, 10) * 60 + Number.parseInt(secondsRaw, 10) - ticks * 30
  let period = Number.parseInt(periodRaw, 10)

  while (totalSeconds <= 0) {
    period += 1
    totalSeconds += 12 * 60
    if (period > 4) {
      return `${prefix}${period - 1} 00:00`
    }
  }

  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0')
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return `${prefix}${period} ${minutes}:${seconds}`
}
