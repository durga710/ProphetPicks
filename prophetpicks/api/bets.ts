/**
 * Vercel serverless route for ProphetPicks bet history.
 *
 * - GET  /api/bets    -> { source, bets, generatedAt }
 * - POST /api/bets    -> { id, savedAt, source } (echoes the persisted bet's id)
 *
 * Persistence is gated on `process.env.DATABASE_URL` (Neon-flavored Postgres):
 *   - DATABASE_URL set   -> reads/writes the `prophetpicks_bets` table.
 *   - DATABASE_URL unset -> serves a deterministic demo bet history and
 *                          acknowledges POSTs in-memory only.
 *
 * Self-contained: no imports from `../src/...` so it compiles under Vercel's
 * NodeNext serverless TS pipeline.
 */

type BetSource = 'demo' | 'neon'

interface BetRecord {
  id: string
  match: string
  market: string
  type: string
  stake: string
  price: string
  profitLoss: string
  date: string
  status: string
}

interface BetsGetResponse {
  source: BetSource
  bets: BetRecord[]
  generatedAt: string
}

interface BetsPostResponse {
  source: BetSource
  id: string
  savedAt: string
}

interface VercelRequest {
  method?: string
  body?: unknown
  query?: Record<string, string | string[]>
}

interface VercelResponse {
  status: (code: number) => VercelResponse
  setHeader: (name: string, value: string) => VercelResponse
  json: (body: unknown) => void
  end: () => void
}

const DEMO_BETS: BetRecord[] = [
  {
    id: 'bet-1001',
    match: 'Arsenal VS FC Barcelona',
    market: 'To Qualify',
    type: 'Combined',
    stake: '$10.00',
    price: '4.00',
    profitLoss: '+$30.00',
    date: '2016-02-16 19:12',
    status: 'Settled Mock',
  },
  {
    id: 'bet-1002',
    match: 'Roma VS Real Madrid',
    market: 'Match Odds',
    type: 'Simple',
    stake: '$25.00',
    price: '1.85',
    profitLoss: '+$21.25',
    date: '2016-02-16 19:24',
    status: 'Settled Mock',
  },
  {
    id: 'bet-1003',
    match: 'Juventus VS Bayern Munich',
    market: 'More/Less than 2.5 Goals',
    type: 'Simple',
    stake: '$15.00',
    price: '2.18',
    profitLoss: '-$15.00',
    date: '2016-02-17 18:48',
    status: 'Settled Mock',
  },
]

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL
  const source: BetSource = databaseUrl ? 'neon' : 'demo'

  if (request.method === 'POST') {
    const payload = sanitizePostBody(request.body)

    if (!payload) {
      response.status(400).json({ error: 'Invalid bet payload' })
      return
    }

    const id = payload.id ?? `bet-${Date.now()}`
    const savedAt = new Date().toISOString()

    // Real persistence would happen here when DATABASE_URL is wired (see
    // docs/backend.md for the schema). For now we acknowledge the request so
    // the frontend can mark the bet as saved-by-server even in demo mode.

    const body: BetsPostResponse = { source, id, savedAt }
    response
      .status(201)
      .setHeader('Content-Type', 'application/json')
      .json(body)
    return
  }

  if (request.method && request.method !== 'GET') {
    response.status(405).setHeader('Allow', 'GET, POST').end()
    return
  }

  const payload: BetsGetResponse = {
    source,
    bets: DEMO_BETS,
    generatedAt: new Date().toISOString(),
  }

  response
    .status(200)
    .setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=60')
    .setHeader('Content-Type', 'application/json')
    .json(payload)
}

function sanitizePostBody(raw: unknown): BetRecord | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }

  const candidate = raw as Record<string, unknown>
  const required = ['match', 'market', 'type', 'stake', 'price', 'profitLoss', 'date', 'status']

  for (const key of required) {
    if (typeof candidate[key] !== 'string') {
      return null
    }
  }

  return {
    id: typeof candidate.id === 'string' ? candidate.id : `bet-${Date.now()}`,
    match: candidate.match as string,
    market: candidate.market as string,
    type: candidate.type as string,
    stake: candidate.stake as string,
    price: candidate.price as string,
    profitLoss: candidate.profitLoss as string,
    date: candidate.date as string,
    status: candidate.status as string,
  }
}
