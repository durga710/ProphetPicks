/**
 * Vercel serverless route returning ProphetPicks odds quote metadata.
 *
 * - Provider keys are read from `process.env` (server-side only).
 * - When `ODDS_API_KEY` is set, queries https://the-odds-api.com for live NFL
 *   moneylines/spreads/totals across the US books and normalizes them into the
 *   `OddsQuote` shape consumed by `src/data/providers/oddsApi.ts`.
 * - On any upstream failure (network, 401, 429, malformed body), returns
 *   `source: 'odds-api'` with `quotes: []` so the frontend falls back to its
 *   deterministic local demo board.
 * - When no provider key is configured (default for the personal-use demo),
 *   the response advertises `source: 'demo'` with an empty `quotes` array.
 * - Self-contained (no `../src/...` imports) so it compiles under Vercel's
 *   NodeNext serverless TS pipeline.
 */

type OddsApiSource = 'demo' | 'odds-api' | 'api-football'

interface OddsQuotePayload {
  id: string
  eventId: string
  sportLabel: string
  league: string
  matchup: string
  marketLabel: string
  selectionLabel: string
  decimalOdds: number
  americanOdds: number
  impliedProbability: number
  source: string
  updatedAt: string
}

interface OddsApiResponse {
  source: OddsApiSource
  quotes: OddsQuotePayload[]
  generatedAt: string
}

interface VercelRequest {
  method?: string
  query?: Record<string, string | string[]>
}

interface VercelResponse {
  status: (code: number) => VercelResponse
  setHeader: (name: string, value: string) => VercelResponse
  json: (body: unknown) => void
  end: () => void
}

interface OddsApiOutcome {
  name: string
  price: number
  point?: number
}

interface OddsApiMarket {
  key: string
  outcomes: OddsApiOutcome[]
}

interface OddsApiBookmaker {
  key: string
  title: string
  last_update: string
  markets: OddsApiMarket[]
}

interface OddsApiEvent {
  id: string
  sport_key: string
  sport_title: string
  commence_time: string
  home_team: string
  away_team: string
  bookmakers: OddsApiBookmaker[]
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

  const oddsApiKey = process.env.ODDS_API_KEY
  const apiFootballKey = process.env.APIFOOTBALL_KEY

  let source: OddsApiSource = 'demo'

  if (oddsApiKey) {
    source = 'odds-api'
  } else if (apiFootballKey) {
    source = 'api-football'
  }

  let quotes: OddsQuotePayload[] = []

  if (source === 'odds-api' && oddsApiKey) {
    quotes = await fetchOddsApiQuotes(oddsApiKey)
  }

  const payload: OddsApiResponse = {
    source,
    quotes,
    generatedAt: new Date().toISOString(),
  }

  response
    .status(200)
    .setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60')
    .setHeader('Content-Type', 'application/json')
    .json(payload)
}

async function fetchOddsApiQuotes(apiKey: string): Promise<OddsQuotePayload[]> {
  const controller =
    typeof AbortController === 'function' ? new AbortController() : null
  const timeout = controller
    ? setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)
    : null

  const url = new URL('https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds')
  url.searchParams.set('apiKey', apiKey)
  url.searchParams.set('regions', 'us')
  url.searchParams.set('markets', 'h2h,spreads,totals')
  url.searchParams.set('oddsFormat', 'decimal')

  try {
    const response = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      signal: controller?.signal,
    })

    if (!response.ok) {
      return []
    }

    const events = (await response.json()) as OddsApiEvent[]

    if (!Array.isArray(events)) {
      return []
    }

    return events.flatMap((event) => normalizeOddsApiEvent(event))
  } catch {
    return []
  } finally {
    if (timeout) {
      clearTimeout(timeout)
    }
  }
}

function normalizeOddsApiEvent(event: OddsApiEvent): OddsQuotePayload[] {
  const quotes: OddsQuotePayload[] = []
  const matchup = `${event.home_team} VS ${event.away_team}`
  const eventId = event.id

  for (const book of event.bookmakers ?? []) {
    for (const market of book.markets ?? []) {
      const marketLabel = marketLabelFromKey(market.key)
      if (!marketLabel) {
        continue
      }

      for (const outcome of market.outcomes ?? []) {
        if (typeof outcome.price !== 'number' || outcome.price <= 1) {
          continue
        }

        const selectionLabel = formatOutcomeLabel(outcome, market.key, event)
        const decimalOdds = outcome.price
        const americanOdds = decimalToAmericanOdds(decimalOdds)
        const id = `${book.key}:${eventId}:${market.key}:${outcome.name}`

        quotes.push({
          id,
          eventId,
          sportLabel: event.sport_title,
          league: event.sport_title,
          matchup,
          marketLabel,
          selectionLabel,
          decimalOdds,
          americanOdds,
          impliedProbability: 1 / decimalOdds,
          source: `Odds API: ${book.title}`,
          updatedAt: book.last_update,
        })
      }
    }
  }

  return quotes
}

function marketLabelFromKey(key: string): string | null {
  switch (key) {
    case 'h2h':
      return 'Moneyline'
    case 'spreads':
      return 'Spread'
    case 'totals':
      return 'Total'
    default:
      return null
  }
}

function formatOutcomeLabel(
  outcome: OddsApiOutcome,
  marketKey: string,
  event: OddsApiEvent,
): string {
  if (marketKey === 'totals') {
    const direction = outcome.name === 'Over' ? 'Over' : 'Under'
    if (typeof outcome.point === 'number') {
      return `${direction} ${outcome.point.toFixed(1)}`
    }
    return direction
  }

  if (marketKey === 'spreads') {
    const team = outcome.name === event.home_team ? event.home_team : event.away_team
    const point = typeof outcome.point === 'number' ? formatPoint(outcome.point) : ''
    return `${team} ${point}`.trim()
  }

  return outcome.name
}

function formatPoint(point: number): string {
  if (point > 0) {
    return `+${point.toFixed(1)}`
  }
  return point.toFixed(1)
}

function decimalToAmericanOdds(decimalOdds: number): number {
  if (decimalOdds >= 2) {
    return Math.round((decimalOdds - 1) * 100)
  }
  return Math.round(-100 / (decimalOdds - 1))
}
