import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  buildApiFootballUrl,
  normalizeApiFootballFixture,
  type ApiFootballFixtureResponseItem,
  type ApiFootballQuery,
} from '../src/data/providers/apiFootball'

const API_KEY_ENV = 'APIFOOTBALL_KEY'
const ALT_API_KEY_ENV = 'API_FOOTBALL_KEY'
const DEFAULT_OUTPUT = new URL(
  '../src/data/generated/soccer-fixtures.json',
  import.meta.url,
)

interface ApiFootballEnvelope<T> {
  errors: unknown[] | Record<string, string>
  response: T[]
  paging?: {
    current: number
    total: number
  }
}

interface SyncOptions {
  league: number
  season: number
  date?: string
  from?: string
  to?: string
  timezone?: string
  output: URL
}

function requireApiFootballKey(env: NodeJS.ProcessEnv): string {
  const apiKey = env[API_KEY_ENV] ?? env[ALT_API_KEY_ENV]

  if (!apiKey) {
    throw new Error(
      `${API_KEY_ENV} is required. Put it in your shell or .env runner, never in Vite client env.`,
    )
  }

  return apiKey
}

function parseArgs(args: string[]): SyncOptions {
  const values = new Map<string, string>()

  args.forEach((arg) => {
    const [key, value] = arg.replace(/^--/, '').split('=')

    if (key && value) {
      values.set(key, value)
    }
  })

  const output = values.has('output')
    ? new URL(values.get('output') ?? '', pathToFileURL(`${process.cwd()}/`))
    : DEFAULT_OUTPUT

  return {
    league: Number(values.get('league') ?? 39),
    season: Number(values.get('season') ?? 2025),
    date: values.get('date'),
    from: values.get('from'),
    to: values.get('to'),
    timezone: values.get('timezone') ?? 'America/New_York',
    output,
  }
}

function hasProviderErrors(errors: ApiFootballEnvelope<unknown>['errors']): boolean {
  if (Array.isArray(errors)) {
    return errors.length > 0
  }

  return Object.keys(errors).length > 0
}

async function main(): Promise<void> {
  const apiKey = requireApiFootballKey(process.env)
  const options = parseArgs(process.argv.slice(2))
  const query: ApiFootballQuery = {
    league: options.league,
    season: options.season,
    date: options.date,
    from: options.from,
    to: options.to,
    timezone: options.timezone,
  }
  const url = buildApiFootballUrl('/fixtures', query)
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'x-apisports-key': apiKey,
      accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`API-Football request failed with HTTP ${response.status}`)
  }

  const payload =
    (await response.json()) as ApiFootballEnvelope<ApiFootballFixtureResponseItem>

  if (hasProviderErrors(payload.errors)) {
    throw new Error('API-Football returned provider errors; inspect dashboard logs')
  }

  const fixtures = payload.response.map(normalizeApiFootballFixture)
  const outputPath = fileURLToPath(options.output)

  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(
    outputPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        provider: 'api-football',
        query,
        fixtures,
      },
      null,
      2,
    )}\n`,
  )

  const dailyRemaining = response.headers.get('x-ratelimit-requests-remaining')
  const minuteRemaining = response.headers.get('x-ratelimit-remaining')

  console.log(`Wrote ${fixtures.length} soccer fixtures to ${outputPath}`)

  if (dailyRemaining || minuteRemaining) {
    console.log(
      `API-Football remaining: daily=${dailyRemaining ?? 'unknown'} minute=${
        minuteRemaining ?? 'unknown'
      }`,
    )
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
