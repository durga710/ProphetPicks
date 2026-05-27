import type { LegacyBet, LegacySlipItem } from '../legacyBetfair'

/**
 * Optional persistence client for ProphetPicks.
 *
 * Talks to the Vercel routes /api/bets (GET, POST) and /api/slips (POST).
 * Every call is fire-and-forget from the UI's perspective: failures resolve
 * to a sentinel value (`null` for loads, `false` for saves) instead of
 * throwing, so the React state remains the source of truth and the app keeps
 * working when the server is unreachable.
 */

const BETS_ENDPOINT = '/api/bets'
const SLIPS_ENDPOINT = '/api/slips'
const REQUEST_TIMEOUT_MS = 3000

export type PersistenceSource = 'demo' | 'neon'

export interface LoadedBets {
  source: PersistenceSource
  bets: LegacyBet[]
}

interface BetsApiResponse {
  source: PersistenceSource
  bets: LegacyBet[]
  generatedAt: string
}

interface BetSaveResponse {
  source: PersistenceSource
  id: string
  savedAt: string
}

interface SlipSaveResponse {
  source: PersistenceSource
  slipId: string
  savedAt: string
  legCount: number
}

export async function loadBets(): Promise<LoadedBets | null> {
  const json = await safeFetchJson<BetsApiResponse>(BETS_ENDPOINT)

  if (!json || !Array.isArray(json.bets)) {
    return null
  }

  return { source: json.source, bets: json.bets }
}

export async function saveBet(bet: LegacyBet): Promise<BetSaveResponse | null> {
  return safeFetchJson<BetSaveResponse>(BETS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bet),
  })
}

export async function saveSlip(
  items: LegacySlipItem[],
  mode: 'simple' | 'combined',
  stake: number,
): Promise<SlipSaveResponse | null> {
  if (items.length === 0) {
    return null
  }

  const legs = items.map((item) => ({
    eventId: item.event.id,
    marketId: item.market.id,
    selectionId: item.selection.id,
    selectionLabel: item.selection.label,
    decimalOdds: item.selection.odds,
  }))

  return safeFetchJson<SlipSaveResponse>(SLIPS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode, stake, legs }),
  })
}

interface LiveGameSnapshot {
  id: string
  eventId: string
  league: string
  status: string
  homeCode: string
  awayCode: string
  homeScore: number
  awayScore: number
}

interface LiveApiResponse {
  source: 'demo' | 'sportradar' | 'odds-api' | 'sportsdb'
  games: LiveGameSnapshot[]
  generatedAt: string
}

/**
 * Prefer the real TheSportsDB-backed /api/livescore feed; fall back to the
 * demo /api/live route only if the real endpoint errors out (network blip,
 * upstream 5xx). The frontend renders the source label so the user can
 * always see whether they're looking at real or demo data.
 */
export async function loadLiveState(): Promise<LiveApiResponse | null> {
  const real = await safeFetchJson<LiveApiResponse>('/api/livescore')
  if (real) {
    return real
  }
  return safeFetchJson<LiveApiResponse>('/api/live')
}

interface SavedSlipApiSummary {
  slipId: string
  mode: 'simple' | 'combined'
  stake: number
  savedAt: string
  legCount: number
  topSelection: string
  combinedPrice: number
}

interface SlipsListApiResponse {
  source: PersistenceSource
  slips: SavedSlipApiSummary[]
  generatedAt: string
}

export async function loadSavedSlips(): Promise<SlipsListApiResponse | null> {
  return safeFetchJson<SlipsListApiResponse>(SLIPS_ENDPOINT)
}

interface TeamLogoApiResponse {
  source: 'sportsdb' | 'demo'
  name: string
  logoUrl: string | null
  sport: string | null
}

/**
 * Resolve a real team badge URL from the server proxy (TheSportsDB v1).
 * Returns null on any error or when the upstream has no badge on file.
 */
export async function loadTeamLogo(name: string): Promise<string | null> {
  if (!name) {
    return null
  }

  const json = await safeFetchJson<TeamLogoApiResponse>(
    `/api/team-logo?name=${encodeURIComponent(name)}`,
  )

  if (!json || json.source !== 'sportsdb' || !json.logoUrl) {
    return null
  }

  return json.logoUrl
}

async function safeFetchJson<T>(
  url: string,
  init: RequestInit = {},
): Promise<T | null> {
  if (typeof fetch !== 'function') {
    return null
  }

  const controller =
    typeof AbortController === 'function' ? new AbortController() : null
  const timeout = controller
    ? setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    : null

  try {
    const response = await fetch(url, {
      ...init,
      headers: { Accept: 'application/json', ...(init.headers ?? {}) },
      signal: controller?.signal,
    })

    if (!response.ok) {
      return null
    }

    return (await response.json()) as T
  } catch {
    return null
  } finally {
    if (timeout) {
      clearTimeout(timeout)
    }
  }
}
