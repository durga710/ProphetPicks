/**
 * Team logo URL builder backed by ESPN's public CDN.
 *
 * - GET /api/team-logo?name=<full-team-name>&sport=<sport-key>&code=<short-code>
 * - Returns { source, name, logoUrl, sport } where logoUrl is a deterministic
 *   ESPN CDN URL (no upstream call needed) for the major US sports + a
 *   curated set of soccer / NCAA team IDs.
 *
 * Why not TheSportsDB? Their free public key only ever returns "Arsenal"
 * as a sample. Real search requires a paid Patreon tier. ESPN's CDN serves
 * the actual league-licensed logo images at publicly-stable URLs that are
 * fine for a personal-use simulator (the same URLs power countless
 * fantasy-sports sites). If a URL is ever pulled, the browser's <img
 * onError> handler in TeamCrest silently falls back to the abstract crest.
 *
 * For sports without team logos (golf / tennis / UFC / boxing / F1 /
 * esports) we return `logoUrl: null` and the UI keeps the gradient crest.
 */

type LogoSource = 'espn-cdn' | 'none'

interface LogoResponse {
  source: LogoSource
  name: string
  logoUrl: string | null
  sport: string | null
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

// Soccer + NCAA use numeric ESPN team IDs, not abbreviations.
const SOCCER_TEAM_IDS: Record<string, number> = {
  arsenal: 359,
  'fc barcelona': 83,
  barcelona: 83,
  roma: 104,
  'real madrid': 86,
  juventus: 111,
  'bayern munich': 132,
  'paris saint-germain': 160,
  psg: 160,
  chelsea: 363,
  benfica: 1929,
  zenit: 2440,
}

const NCAA_TEAM_IDS: Record<string, number> = {
  'georgia bulldogs': 61,
  georgia: 61,
  'alabama crimson tide': 333,
  alabama: 333,
  'michigan wolverines': 130,
  michigan: 130,
  'ohio state buckeyes': 194,
  'ohio state': 194,
  'duke blue devils': 150,
  duke: 150,
  'kansas jayhawks': 2305,
  kansas: 2305,
  'north carolina tar heels': 153,
  unc: 153,
  'uconn huskies': 41,
  uconn: 41,
}

// US-major-sport abbreviation overrides (when my seed's code differs from
// ESPN's URL slug). Default is to lowercase the seed code.
const ABBR_OVERRIDES: Record<string, string> = {
  GSW: 'gs',
  NYK: 'ny',
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
): Promise<void> {
  if (request.method && request.method !== 'GET') {
    response.status(405).setHeader('Allow', 'GET').end()
    return
  }

  const name = readQuery(request.query?.name)
  const sport = readQuery(request.query?.sport).toLowerCase()
  const code = readQuery(request.query?.code).toUpperCase()

  if (!name && !code) {
    response.status(400).json({ error: 'Missing `name` or `code` query parameter' })
    return
  }

  const logoUrl = buildLogoUrl(sport, code, name)

  const body: LogoResponse = {
    source: logoUrl ? 'espn-cdn' : 'none',
    name: name || code,
    logoUrl,
    sport: sport || null,
  }

  response
    .status(200)
    .setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800')
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

function buildLogoUrl(
  sport: string,
  code: string,
  name: string,
): string | null {
  const normalizedSport = sport.toLowerCase()
  const normalizedName = name.toLowerCase()

  if (['nfl', 'nba', 'mlb', 'nhl'].includes(normalizedSport)) {
    const slug = ABBR_OVERRIDES[code] ?? code.toLowerCase()
    if (!slug) {
      return null
    }
    return `https://a.espncdn.com/i/teamlogos/${normalizedSport}/500/${slug}.png`
  }

  if (normalizedSport === 'soccer') {
    const id = SOCCER_TEAM_IDS[normalizedName]
    if (typeof id !== 'number') {
      return null
    }
    return `https://a.espncdn.com/i/teamlogos/soccer/500/${id}.png`
  }

  if (normalizedSport === 'ncaaf' || normalizedSport === 'ncaab') {
    const id = NCAA_TEAM_IDS[normalizedName]
    if (typeof id !== 'number') {
      return null
    }
    return `https://a.espncdn.com/i/teamlogos/ncaa/500/${id}.png`
  }

  return null
}
