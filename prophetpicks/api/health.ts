/**
 * Vercel serverless health probe for ProphetPicks.
 *
 * - GET /api/health -> { status, providers, ts }
 *
 * Reports which optional integrations have credentials configured server-side.
 * Never leaks the credential values themselves - only booleans.
 * Useful for the frontend to badge the active feed source on the Odds Board.
 */

interface HealthResponse {
  status: 'ok'
  providers: {
    neon: boolean
    oddsApi: boolean
    apiFootball: boolean
    sportradar: boolean
  }
  ts: string
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

  const payload: HealthResponse = {
    status: 'ok',
    providers: {
      neon: Boolean(process.env.DATABASE_URL),
      oddsApi: Boolean(process.env.ODDS_API_KEY),
      apiFootball: Boolean(process.env.APIFOOTBALL_KEY),
      sportradar: Boolean(process.env.SPORTRADAR_API_KEY),
    },
    ts: new Date().toISOString(),
  }

  response
    .status(200)
    .setHeader('Cache-Control', 'no-store')
    .setHeader('Content-Type', 'application/json')
    .json(payload)
}
