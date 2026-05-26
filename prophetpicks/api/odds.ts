/**
 * Vercel serverless route returning ProphetPicks odds quote metadata.
 *
 * - Provider keys are read from `process.env` (server-side only).
 * - When no provider key is configured (default for the personal-use demo),
 *   the response advertises `source: 'demo'` with an empty `quotes` array.
 *   The browser client in `src/data/providers/oddsApi.ts` falls back to its
 *   deterministic local demo board in that case, so the app keeps working
 *   without any credentials.
 * - This file is intentionally self-contained (no `../src/...` imports) so it
 *   compiles cleanly under Vercel's Node serverless TypeScript pipeline
 *   regardless of frontend module-resolution settings.
 */

type OddsApiSource = 'demo' | 'odds-api' | 'api-football'

interface OddsApiResponse {
  source: OddsApiSource
  quotes: unknown[]
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

  // The personal-use demo intentionally returns an empty quote list so the
  // browser falls back to the deterministic local board. Wire a real upstream
  // fetch here (gated on the matching key) once you are ready to pull live
  // prices and respect the provider's rate limits and ToS.
  const payload: OddsApiResponse = {
    source,
    quotes: [],
    generatedAt: new Date().toISOString(),
  }

  response
    .status(200)
    .setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60')
    .setHeader('Content-Type', 'application/json')
    .json(payload)
}
