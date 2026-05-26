import { buildOddsQuotes, type OddsQuote } from '../../domain/oddsBoard'

export type OddsApiSource = 'demo' | 'odds-api' | 'api-football'

export interface OddsApiResponse {
  source: OddsApiSource
  quotes: OddsQuote[]
  generatedAt: string
}

export interface LoadedOddsQuotes {
  quotes: OddsQuote[]
  source: OddsApiSource | 'local-fallback'
  statusLabel: string
}

const PROXY_ENDPOINT = '/api/odds'
const REQUEST_TIMEOUT_MS = 4000

export async function loadOddsQuotes(): Promise<LoadedOddsQuotes> {
  const fallback: LoadedOddsQuotes = {
    quotes: buildOddsQuotes(),
    source: 'local-fallback',
    statusLabel: 'Local demo quotes loaded',
  }

  if (typeof fetch !== 'function') {
    return fallback
  }

  const controller =
    typeof AbortController === 'function' ? new AbortController() : null
  const timeout = controller
    ? setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    : null

  try {
    const response = await fetch(PROXY_ENDPOINT, {
      headers: { Accept: 'application/json' },
      signal: controller?.signal,
    })

    if (!response.ok) {
      return fallback
    }

    const payload = (await response.json()) as Partial<OddsApiResponse>

    if (!payload || !Array.isArray(payload.quotes)) {
      return fallback
    }

    const reportedSource = payload.source ?? 'demo'
    const statusLabel = describeSource(reportedSource, payload.generatedAt)

    if (payload.quotes.length === 0) {
      return {
        quotes: fallback.quotes,
        source: reportedSource,
        statusLabel: `${statusLabel} - local demo board`,
      }
    }

    return {
      quotes: payload.quotes,
      source: reportedSource,
      statusLabel,
    }
  } catch {
    return fallback
  } finally {
    if (timeout) {
      clearTimeout(timeout)
    }
  }
}

function describeSource(source: OddsApiSource, generatedAt?: string): string {
  const stamp = generatedAt
    ? new Date(generatedAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null
  const stampLabel = stamp ? ` (updated ${stamp})` : ''

  switch (source) {
    case 'odds-api':
      return `The Odds API live feed${stampLabel}`
    case 'api-football':
      return `API-Football live feed${stampLabel}`
    default:
      return `Demo book quotes${stampLabel}`
  }
}
