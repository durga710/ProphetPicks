import { neon } from '@neondatabase/serverless'

/**
 * Vercel serverless route for ProphetPicks bet history.
 *
 * - GET  /api/bets  -> { source, bets, generatedAt }
 * - POST /api/bets  -> { id, savedAt, source }
 *
 * Persistence is gated on `process.env.DATABASE_URL` (Neon-flavored Postgres):
 *   - DATABASE_URL set   -> reads/writes the `prophetpicks_bets` table via
 *                          @neondatabase/serverless. Errors degrade to demo.
 *   - DATABASE_URL unset -> serves a deterministic demo bet history and
 *                          acknowledges POSTs in-memory only.
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

  if (request.method === 'POST') {
    const payload = sanitizePostBody(request.body)

    if (!payload) {
      response.status(400).json({ error: 'Invalid bet payload' })
      return
    }

    const id = payload.id || `bet-${Date.now()}`
    const savedAt = new Date().toISOString()
    let source: BetSource = 'demo'

    if (databaseUrl) {
      const persisted = await insertBet(databaseUrl, { ...payload, id })
      if (persisted) {
        source = 'neon'
      }
    }

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

  let bets: BetRecord[] = DEMO_BETS
  let source: BetSource = 'demo'

  if (databaseUrl) {
    const persisted = await selectBets(databaseUrl)
    if (persisted) {
      bets = persisted
      source = 'neon'
    }
  }

  const payload: BetsGetResponse = {
    source,
    bets,
    generatedAt: new Date().toISOString(),
  }

  response
    .status(200)
    .setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=60')
    .setHeader('Content-Type', 'application/json')
    .json(payload)
}

async function insertBet(
  connectionString: string,
  bet: BetRecord,
): Promise<boolean> {
  try {
    const sql = neon(connectionString)
    await sql`
      insert into prophetpicks_bets
        (id, match, market, type, stake, price, profit_loss, status)
      values
        (${bet.id}, ${bet.match}, ${bet.market}, ${bet.type},
         ${bet.stake}, ${bet.price}, ${bet.profitLoss}, ${bet.status})
      on conflict (id) do update set
        match = excluded.match,
        market = excluded.market,
        type = excluded.type,
        stake = excluded.stake,
        price = excluded.price,
        profit_loss = excluded.profit_loss,
        status = excluded.status
    `
    return true
  } catch {
    return false
  }
}

async function selectBets(connectionString: string): Promise<BetRecord[] | null> {
  try {
    const sql = neon(connectionString)
    const rows = (await sql`
      select id, match, market, type, stake, price, profit_loss, status,
             to_char(placed_at, 'YYYY-MM-DD HH24:MI') as date
        from prophetpicks_bets
       order by placed_at desc
       limit 50
    `) as Array<Record<string, unknown>>

    return rows.map((row) => ({
      id: String(row.id ?? ''),
      match: String(row.match ?? ''),
      market: String(row.market ?? ''),
      type: String(row.type ?? ''),
      stake: String(row.stake ?? ''),
      price: String(row.price ?? ''),
      profitLoss: String(row.profit_loss ?? ''),
      date: String(row.date ?? ''),
      status: String(row.status ?? ''),
    }))
  } catch {
    return null
  }
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
