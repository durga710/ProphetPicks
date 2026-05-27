/**
 * Real pre-game stat-pack proxy backed by ESPN's summary endpoint.
 *
 * - GET /api/stat-pack?sport=<key>&eventId=<id>
 * - Returns a normalized stat-pack:
 *     { source, sport, eventId,
 *       homeName, awayName,
 *       homeForm, awayForm,                    (e.g. "W W L W W")
 *       headToHead: string[],
 *       injuries: string[],
 *       leaders: string[],
 *       pickcenter: { provider, spread, total, homeMoneyLine, awayMoneyLine } | null,
 *       angle: string,
 *       generatedAt }
 * - No auth needed. Soft-falls to a curated demo stat-pack on error.
 */

type StatPackSource = 'espn' | 'demo'

interface PickcenterSnapshot {
  provider: string
  spread: number | null
  total: number | null
  homeMoneyLine: number | null
  awayMoneyLine: number | null
}

interface StatPackResponse {
  source: StatPackSource
  sport: string
  eventId: string
  homeName: string
  awayName: string
  homeForm: string
  awayForm: string
  headToHead: string[]
  injuries: string[]
  leaders: string[]
  pickcenter: PickcenterSnapshot | null
  angle: string
  generatedAt: string
}

interface VercelRequest {
  method?: string
  query?: Record<string, string | string[] | undefined>
}

interface VercelResponse {
  status: (code: number) => VercelResponse
  setHeader: (name: string, value: string) => VercelResponse
  json: (body: unknown) => void
  end: () => void
}

interface EspnTeamRef {
  displayName?: string
  abbreviation?: string
}

interface EspnEventResult {
  score?: string
  gameResult?: 'W' | 'L' | 'T' | null
  opponent?: EspnTeamRef
}

interface EspnLastFiveBlock {
  team?: EspnTeamRef
  events?: EspnEventResult[]
}

interface EspnInjuryEntry {
  status?: string
  athlete?: { displayName?: string; position?: { abbreviation?: string } }
}

interface EspnInjuryBlock {
  team?: EspnTeamRef
  injuries?: EspnInjuryEntry[]
}

interface EspnLeaderEntry {
  displayName?: string
  leaders?: Array<{
    athlete?: { displayName?: string; jersey?: string }
    displayValue?: string
  }>
}

interface EspnLeaderBlock {
  team?: EspnTeamRef
  leaders?: EspnLeaderEntry[]
}

interface EspnPickcenter {
  provider?: { name?: string }
  spread?: number | string
  overUnder?: number | string
  homeTeamOdds?: { moneyLine?: number | string }
  awayTeamOdds?: { moneyLine?: number | string }
}

interface EspnH2HEvent {
  date?: string
  gameDate?: string
  competitions?: Array<{
    competitors?: Array<{
      homeAway?: 'home' | 'away'
      score?: string
      team?: EspnTeamRef
    }>
  }>
}

interface EspnSummaryResponse {
  header?: {
    competitions?: Array<{
      competitors?: Array<{
        homeAway?: 'home' | 'away'
        team?: EspnTeamRef
      }>
    }>
  }
  lastFiveGames?: EspnLastFiveBlock[]
  injuries?: EspnInjuryBlock[]
  leaders?: EspnLeaderBlock[]
  pickcenter?: EspnPickcenter[]
  headToHeadGames?: EspnH2HEvent[]
}

const UPSTREAM_TIMEOUT_MS = 4500

const SPORT_TO_LEAGUE_PATH: Record<string, string> = {
  nfl: 'football/nfl',
  nba: 'basketball/nba',
  mlb: 'baseball/mlb',
  nhl: 'hockey/nhl',
  soccer: 'soccer/uefa.champions',
  ncaaf: 'football/college-football',
  ncaab: 'basketball/mens-college-basketball',
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
): Promise<void> {
  if (request.method && request.method !== 'GET') {
    response.status(405).setHeader('Allow', 'GET').end()
    return
  }

  const sport = readQuery(request.query?.sport).toLowerCase()
  const eventId = readQuery(request.query?.eventId)

  if (!sport || !eventId) {
    response.status(400).json({ error: 'Missing `sport` and/or `eventId` query parameter' })
    return
  }

  const leaguePath = SPORT_TO_LEAGUE_PATH[sport]
  if (!leaguePath) {
    response.status(200).setHeader('Content-Type', 'application/json').json({
      source: 'demo',
      sport,
      eventId,
      homeName: '',
      awayName: '',
      homeForm: '',
      awayForm: '',
      headToHead: [],
      injuries: [],
      leaders: [],
      pickcenter: null,
      angle: '',
      generatedAt: new Date().toISOString(),
    })
    return
  }

  const pack = await fetchStatPack(leaguePath, eventId)
  const body: StatPackResponse = {
    source: 'espn',
    sport,
    eventId,
    ...pack,
    generatedAt: new Date().toISOString(),
  }

  response
    .status(200)
    .setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=600')
    .setHeader('Content-Type', 'application/json')
    .json(body)
}

function readQuery(value: string | string[] | undefined): string {
  if (typeof value === 'string') {
    return value
  }
  if (Array.isArray(value)) {
    return value[0] ?? ''
  }
  return ''
}

async function fetchStatPack(
  leaguePath: string,
  eventId: string,
): Promise<Omit<StatPackResponse, 'source' | 'sport' | 'eventId' | 'generatedAt'>> {
  const empty: Omit<StatPackResponse, 'source' | 'sport' | 'eventId' | 'generatedAt'> = {
    homeName: '',
    awayName: '',
    homeForm: '',
    awayForm: '',
    headToHead: [],
    injuries: [],
    leaders: [],
    pickcenter: null,
    angle: '',
  }

  const controller =
    typeof AbortController === 'function' ? new AbortController() : null
  const timeout = controller
    ? setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)
    : null

  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/${leaguePath}/summary?event=${encodeURIComponent(eventId)}`
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller?.signal,
    })

    if (!response.ok) {
      return empty
    }

    const data = (await response.json()) as EspnSummaryResponse

    const competitors = data.header?.competitions?.[0]?.competitors ?? []
    const home = competitors.find((c) => c.homeAway === 'home')?.team
    const away = competitors.find((c) => c.homeAway === 'away')?.team

    const homeBlock = data.lastFiveGames?.find(
      (b) => b.team?.displayName === home?.displayName,
    )
    const awayBlock = data.lastFiveGames?.find(
      (b) => b.team?.displayName === away?.displayName,
    )

    return {
      homeName: home?.displayName ?? '',
      awayName: away?.displayName ?? '',
      homeForm: formatForm(homeBlock?.events ?? []),
      awayForm: formatForm(awayBlock?.events ?? []),
      headToHead: normalizeHeadToHead(data.headToHeadGames ?? []),
      injuries: normalizeInjuries(data.injuries ?? []),
      leaders: normalizeLeaders(data.leaders ?? []),
      pickcenter: normalizePickcenter(data.pickcenter ?? []),
      angle: '',
    }
  } catch {
    return empty
  } finally {
    if (timeout) {
      clearTimeout(timeout)
    }
  }
}

function formatForm(events: EspnEventResult[]): string {
  if (events.length === 0) {
    return ''
  }
  return events
    .slice(0, 5)
    .map((e) => (e.gameResult ?? '-').toString())
    .join(' ')
}

function normalizeInjuries(blocks: EspnInjuryBlock[]): string[] {
  const lines: string[] = []
  for (const block of blocks) {
    const teamAbbr =
      block.team?.abbreviation ?? block.team?.displayName ?? 'Team'
    for (const injury of block.injuries ?? []) {
      const name = injury.athlete?.displayName ?? 'Unknown'
      const pos = injury.athlete?.position?.abbreviation
      const status = injury.status ?? 'Status TBD'
      const prefix = pos ? `${pos} ${name}` : name
      lines.push(`${teamAbbr}: ${prefix} (${status})`)
      if (lines.length >= 8) {
        return lines
      }
    }
  }
  return lines
}

function normalizeLeaders(blocks: EspnLeaderBlock[]): string[] {
  const lines: string[] = []
  for (const block of blocks) {
    const teamAbbr =
      block.team?.abbreviation ?? block.team?.displayName ?? 'Team'
    for (const category of block.leaders ?? []) {
      const label = category.displayName ?? 'Stat'
      const top = category.leaders?.[0]
      if (!top) {
        continue
      }
      const name = top.athlete?.displayName ?? 'Player'
      const value = top.displayValue ?? '-'
      lines.push(`${teamAbbr} ${label}: ${name} (${value})`)
      if (lines.length >= 6) {
        return lines
      }
    }
  }
  return lines
}

function normalizePickcenter(entries: EspnPickcenter[]): PickcenterSnapshot | null {
  const first = entries[0]
  if (!first) {
    return null
  }
  return {
    provider: first.provider?.name ?? 'Sportsbook',
    spread: toNumber(first.spread),
    total: toNumber(first.overUnder),
    homeMoneyLine: toNumber(first.homeTeamOdds?.moneyLine),
    awayMoneyLine: toNumber(first.awayTeamOdds?.moneyLine),
  }
}

function normalizeHeadToHead(events: EspnH2HEvent[]): string[] {
  return events.slice(0, 4).map((event) => {
    const competitors = event.competitions?.[0]?.competitors ?? []
    const home = competitors.find((c) => c.homeAway === 'home')
    const away = competitors.find((c) => c.homeAway === 'away')
    const homeName = home?.team?.abbreviation ?? home?.team?.displayName ?? 'Home'
    const awayName = away?.team?.abbreviation ?? away?.team?.displayName ?? 'Away'
    const homeScore = home?.score ?? '-'
    const awayScore = away?.score ?? '-'
    const date = (event.date ?? event.gameDate ?? '').slice(0, 10)
    return `${awayName} ${awayScore} @ ${homeName} ${homeScore}${date ? ` — ${date}` : ''}`
  })
}

function toNumber(value: number | string | undefined): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}
