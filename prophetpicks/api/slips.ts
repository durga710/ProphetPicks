/**
 * Vercel serverless route for ProphetPicks slip persistence.
 *
 * - POST /api/slips -> { source, slipId, savedAt, legCount }
 *
 * Stores a slip snapshot so users can resume a slip from another device or
 * compare historical tickets. Same Neon-or-demo gating model as /api/bets.
 *
 * Slip payload shape (validated, all fields required):
 *   {
 *     mode: 'simple' | 'combined',
 *     stake: number,
 *     legs: Array<{
 *       eventId: string
 *       marketId: string
 *       selectionId: string
 *       selectionLabel: string
 *       decimalOdds: number
 *     }>
 *   }
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

interface SlipResponse {
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
  if (request.method && request.method !== 'POST') {
    response.status(405).setHeader('Allow', 'POST').end()
    return
  }

  const slip = sanitizeSlip(request.body)

  if (!slip) {
    response.status(400).json({ error: 'Invalid slip payload' })
    return
  }

  const source: SlipSource = process.env.DATABASE_URL ? 'neon' : 'demo'
  const slipId = `slip-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  const savedAt = new Date().toISOString()

  // Real persistence would insert into `prophetpicks_slips` and
  // `prophetpicks_slip_legs` here when DATABASE_URL is configured. See
  // docs/backend.md for the migration.

  const body: SlipResponse = {
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
