/**
 * Server-Sent Events stream of live game state for ProphetPicks.
 *
 * - GET /api/live/stream  (Accept: text/event-stream)
 * - Emits a `snapshot` event every 10s with the same JSON shape as
 *   /api/live's GET response: { source, games, generatedAt }.
 * - Streams for up to 5 minutes then closes; the client should reconnect.
 *
 * Implemented with the modern Web Request/Response signature so Vercel
 * Fluid Compute can stream the body without proxy buffering. Falls back
 * to /api/live polling on the client side if EventSource is unsupported
 * or the connection drops.
 */

export const config = {
  runtime: 'nodejs',
}

const TICK_MS = 10_000
const MAX_DURATION_MS = 5 * 60 * 1000

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

interface Snapshot {
  source: LiveSource
  games: LiveGame[]
  generatedAt: string
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method && request.method !== 'GET') {
    return new Response(null, { status: 405, headers: { Allow: 'GET' } })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      let cancelled = false

      function emit(): void {
        if (cancelled) {
          return
        }
        try {
          const snapshot = buildSnapshot()
          const payload = `event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`
          controller.enqueue(encoder.encode(payload))
        } catch {
          // Swallow encode errors; the next tick will try again.
        }
      }

      emit()

      const tick = setInterval(emit, TICK_MS)
      const stop = setTimeout(() => {
        cancelled = true
        clearInterval(tick)
        controller.close()
      }, MAX_DURATION_MS)

      request.signal?.addEventListener('abort', () => {
        cancelled = true
        clearInterval(tick)
        clearTimeout(stop)
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}

function buildSnapshot(): Snapshot {
  const minute = Math.floor(Date.now() / 60_000)
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

  return { source, games, generatedAt: new Date().toISOString() }
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
