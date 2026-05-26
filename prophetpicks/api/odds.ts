import {
  buildOddsQuotes,
  type OddsQuote,
} from '../src/domain/oddsBoard'

type OddsApiSource = 'demo' | 'odds-api' | 'api-football'

interface OddsApiResponse {
  source: OddsApiSource
  quotes: OddsQuote[]
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

/**
 * Vercel serverless route returning ProphetPicks odds quotes.
 *
 * - Reads provider keys from `process.env` (server-side only - never exposed to the client).
 * - Falls back to deterministic local demo quotes whenever a provider is missing or
 *   the upstream call fails, so the app stays functional for personal use without credentials.
 * - The response payload matches `OddsApiResponse` defined in
 *   `src/data/providers/oddsApi.ts`.
 */
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

  // Provider plumbing is intentionally placeholder for personal-use demo:
  // when credentials exist we still return demo quotes but tag the source so the
  // UI surfaces which feed is configured. Replace the inner branches with a real
  // upstream fetch once you wire the provider client and obey their rate limits.
  let source: OddsApiSource = 'demo'

  if (oddsApiKey) {
    source = 'odds-api'
  } else if (apiFootballKey) {
    source = 'api-football'
  }

  const payload: OddsApiResponse = {
    source,
    quotes: buildOddsQuotes(),
    generatedAt: new Date().toISOString(),
  }

  response
    .status(200)
    .setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60')
    .setHeader('Content-Type', 'application/json')
    .json(payload)
}
