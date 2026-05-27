/**
 * Real sports-news proxy backed by ESPN's public site API.
 *
 * - GET /api/news?sport=<key>
 *   key ∈ nfl | nba | mlb | nhl | soccer | ncaaf | ncaab | tennis | golf
 *       | f1 | ufc | boxing | cricket
 * - Returns the latest ~8 articles for the requested league, normalized to
 *   { id, headline, description, image, published, link, type }.
 * - No auth required.
 *
 * Soft-falls to source: 'demo', articles: [] on any upstream failure.
 */

type NewsSource = 'espn' | 'demo'

interface NewsArticle {
  id: string
  headline: string
  description: string
  image: string | null
  published: string
  link: string | null
  type: string
}

interface NewsResponse {
  source: NewsSource
  sport: string
  articles: NewsArticle[]
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

interface EspnImage {
  url?: string
}

interface EspnLinkSet {
  web?: { href?: string }
}

interface EspnArticle {
  id?: number | string
  headline?: string
  description?: string
  published?: string
  type?: string
  images?: EspnImage[]
  links?: EspnLinkSet
}

interface EspnNewsResponse {
  articles?: EspnArticle[]
}

const UPSTREAM_TIMEOUT_MS = 4500
const MAX_ARTICLES = 8

const NEWS_ENDPOINTS: Record<string, string> = {
  nfl: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/news',
  nba: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/news',
  mlb: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/news',
  nhl: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/news',
  soccer: 'https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/news',
  ncaaf: 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/news',
  ncaab: 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/news',
  tennis: 'https://site.api.espn.com/apis/site/v2/sports/tennis/news',
  golf: 'https://site.api.espn.com/apis/site/v2/sports/golf/news',
  f1: 'https://site.api.espn.com/apis/site/v2/sports/racing/f1/news',
  ufc: 'https://site.api.espn.com/apis/site/v2/sports/mma/ufc/news',
  boxing: 'https://site.api.espn.com/apis/site/v2/sports/boxing/news',
  cricket: 'https://site.api.espn.com/apis/site/v2/sports/cricket/news',
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
): Promise<void> {
  if (request.method && request.method !== 'GET') {
    response.status(405).setHeader('Allow', 'GET').end()
    return
  }

  const rawSport = request.query?.sport
  const sport =
    typeof rawSport === 'string'
      ? rawSport
      : Array.isArray(rawSport)
        ? rawSport[0]
        : ''

  if (!sport) {
    response.status(400).json({ error: 'Missing `sport` query parameter' })
    return
  }

  const url = NEWS_ENDPOINTS[sport.toLowerCase()]
  if (!url) {
    response
      .status(200)
      .setHeader('Cache-Control', 's-maxage=300')
      .setHeader('Content-Type', 'application/json')
      .json({
        source: 'demo',
        sport,
        articles: [],
        generatedAt: new Date().toISOString(),
      })
    return
  }

  const articles = await fetchNews(url)
  const body: NewsResponse = {
    source: 'espn',
    sport,
    articles,
    generatedAt: new Date().toISOString(),
  }

  response
    .status(200)
    .setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=600')
    .setHeader('Content-Type', 'application/json')
    .json(body)
}

async function fetchNews(url: string): Promise<NewsArticle[]> {
  const controller =
    typeof AbortController === 'function' ? new AbortController() : null
  const timeout = controller
    ? setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)
    : null

  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller?.signal,
    })

    if (!response.ok) {
      return []
    }

    const payload = (await response.json()) as EspnNewsResponse
    const articles = payload.articles ?? []

    return articles
      .slice(0, MAX_ARTICLES)
      .map((article) => normalizeArticle(article))
      .filter((article): article is NewsArticle => article !== null)
  } catch {
    return []
  } finally {
    if (timeout) {
      clearTimeout(timeout)
    }
  }
}

function normalizeArticle(article: EspnArticle): NewsArticle | null {
  if (!article.headline) {
    return null
  }

  const id = String(article.id ?? article.headline)
  const link = article.links?.web?.href ?? null
  const image = article.images?.find((img) => typeof img.url === 'string')?.url ?? null

  return {
    id,
    headline: article.headline,
    description: article.description ?? '',
    image,
    published: article.published ?? new Date().toISOString(),
    link,
    type: article.type ?? 'HeadlineNews',
  }
}
