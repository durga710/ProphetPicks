import { neon } from '@neondatabase/serverless'

/**
 * Vercel serverless route for ProphetPicks slip persistence.
 *
 * - GET  /api/slips -> { source, slips, generatedAt }
 * - POST /api/slips -> { source, slipId, savedAt, legCount }
 *
 * Same Neon-or-demo gating model as /api/bets. Writes go into
 * prophetpicks_slips + prophetpicks_slip_legs in a single transaction.
 */

type SlipSource = 'demo' | 'neon'

interface SlipLeg {
  eventId: string
  marketId: string
  selectionId: string
  selectionLabel: string
  decimalOdds: number
}

interface SlipPayload {
  mode: 'simple' | 'combined'
  stake: number
  legs: SlipLeg[]
}

interface SavedSlipSummary {
  slipId: string
  mode: 'simple' | 'combined'
  stake: number
  savedAt: string
  legCount: number
  topSelection: string
  combinedPrice: number
}

interface SlipsGetResponse {
  source: SlipSource
  slips: SavedSlipSummary[]
  generatedAt: string
}

interface SlipPostResponse {
  source: SlipSource
  slipId: string
  savedAt: string
  legCount: number
}

interface VercelRequest {
  method?: string
  body?: unknown
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
  const databaseUrl = process.env.DATABASE_URL

  if (request.method === 'GET') {
    let source: SlipSource = 'demo'
    let slips: SavedSlipSummary[] = []

    if (databaseUrl) {
      const persisted = await selectSlips(databaseUrl)
      if (persisted) {
        slips = persisted
        source = 'neon'
      }
    }

    const body: SlipsGetResponse = {
      source,
      slips,
      generatedAt: new Date().toISOString(),
    }

    response
      .status(200)
      .setHeader('Cache-Control', 'no-store')
      .setHeader('Content-Type', 'application/json')
      .json(body)
    return
  }

  if (request.method && request.method !== 'POST') {
    response.status(405).setHeader('Allow', 'GET, POST').end()
    return
  }

  const slip = sanitizeSlip(request.body)

  if (!slip) {
    response.status(400).json({ error: 'Invalid slip payload' })
    return
  }

  const slipId = `slip-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  const savedAt = new Date().toISOString()
  let source: SlipSource = 'demo'

  if (databaseUrl) {
    const persisted = await insertSlip(databaseUrl, slipId, slip)
    if (persisted) {
      source = 'neon'
    }
  }

  const body: SlipPostResponse = {
    source,
    slipId,
    savedAt,
    legCount: slip.legs.length,
  }

  response
    .status(201)
    .setHeader('Content-Type', 'application/json')
    .json(body)
}

async function insertSlip(
  connectionString: string,
  slipId: string,
  slip: SlipPayload,
): Promise<boolean> {
  try {
    const sql = neon(connectionString)
    const stakeCents = Math.round(slip.stake * 100)

    await sql`
      insert into prophetpicks_slips (id, mode, stake_cents)
      values (${slipId}, ${slip.mode}, ${stakeCents})
    `

    for (let position = 0; position < slip.legs.length; position += 1) {
      const leg = slip.legs[position]
      await sql`
        insert into prophetpicks_slip_legs
          (slip_id, position, event_id, market_id, selection_id, selection_label, decimal_odds)
        values
          (${slipId}, ${position}, ${leg.eventId}, ${leg.marketId},
           ${leg.selectionId}, ${leg.selectionLabel}, ${leg.decimalOdds})
      `
    }

    return true
  } catch {
    return false
  }
}

async function selectSlips(
  connectionString: string,
): Promise<SavedSlipSummary[] | null> {
  try {
    const sql = neon(connectionString)
    const rows = (await sql`
      with summary as (
        select
          s.id,
          s.mode,
          s.stake_cents,
          s.saved_at,
          count(l.slip_id) as leg_count,
          coalesce(exp(sum(ln(l.decimal_odds))), 0) as combined_price,
          min(l.position) as min_position
        from prophetpicks_slips s
        left join prophetpicks_slip_legs l on l.slip_id = s.id
        group by s.id, s.mode, s.stake_cents, s.saved_at
        order by s.saved_at desc
        limit 25
      )
      select summary.*, top_leg.selection_label as top_selection
        from summary
        left join prophetpicks_slip_legs top_leg
               on top_leg.slip_id = summary.id
              and top_leg.position = summary.min_position
       order by saved_at desc
    `) as Array<Record<string, unknown>>

    return rows.map((row) => ({
      slipId: String(row.id ?? ''),
      mode: (row.mode === 'simple' ? 'simple' : 'combined') as 'simple' | 'combined',
      stake: Number(row.stake_cents ?? 0) / 100,
      savedAt:
        typeof row.saved_at === 'string'
          ? row.saved_at
          : new Date(String(row.saved_at)).toISOString(),
      legCount: Number(row.leg_count ?? 0),
      topSelection: String(row.top_selection ?? '—'),
      combinedPrice: Number(row.combined_price ?? 0),
    }))
  } catch {
    return null
  }
}

function sanitizeSlip(raw: unknown): SlipPayload | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }

  const candidate = raw as Record<string, unknown>
  const mode = candidate.mode
  const stake = candidate.stake
  const legs = candidate.legs

  if (mode !== 'simple' && mode !== 'combined') {
    return null
  }

  if (typeof stake !== 'number' || !Number.isFinite(stake) || stake < 0) {
    return null
  }

  if (!Array.isArray(legs) || legs.length === 0) {
    return null
  }

  const validLegs: SlipLeg[] = []
  for (const leg of legs) {
    if (!leg || typeof leg !== 'object') {
      return null
    }

    const candidateLeg = leg as Record<string, unknown>
    const eventId = candidateLeg.eventId
    const marketId = candidateLeg.marketId
    const selectionId = candidateLeg.selectionId
    const selectionLabel = candidateLeg.selectionLabel
    const decimalOdds = candidateLeg.decimalOdds

    if (
      typeof eventId !== 'string' ||
      typeof marketId !== 'string' ||
      typeof selectionId !== 'string' ||
      typeof selectionLabel !== 'string' ||
      typeof decimalOdds !== 'number' ||
      !Number.isFinite(decimalOdds) ||
      decimalOdds <= 1
    ) {
      return null
    }

    validLegs.push({ eventId, marketId, selectionId, selectionLabel, decimalOdds })
  }

  return { mode, stake, legs: validLegs }
}
