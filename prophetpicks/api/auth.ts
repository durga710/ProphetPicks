/**
 * Single auth dispatcher.
 *
 * Routed via vercel.json rewrites so the friendly URLs survive:
 *   GET      /api/auth/google/start     -> ?action=google-start
 *   GET      /api/auth/google/callback  -> ?action=google-callback
 *   GET      /api/auth/session          -> ?action=session
 *   GET/POST /api/auth/logout           -> ?action=logout
 *
 * Consolidated into a single Vercel function to fit the Hobby plan's
 * 12-function deployment ceiling. No external dependencies; HS256 JWT
 * via Node's crypto.
 */

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

interface VercelRequest {
  method?: string
  query?: Record<string, string | string[] | undefined>
  headers?: {
    cookie?: string | string[]
    host?: string
    'x-forwarded-proto'?: string
  }
}

interface VercelResponse {
  status: (code: number) => VercelResponse
  setHeader: (name: string, value: string | string[]) => VercelResponse
  send: (body: string) => void
  json: (body: unknown) => void
  end: () => void
}

interface GoogleTokenResponse {
  access_token?: string
  id_token?: string
}

interface GoogleUserInfo {
  id?: string
  sub?: string
  email?: string
  name?: string
  picture?: string
}

interface SessionUser {
  id: string
  email: string
  name: string
  picture: string | null
  provider: 'google'
}

interface SessionResponse {
  authProvider: 'google' | 'disabled'
  user: SessionUser | null
}

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
): Promise<void> {
  const raw = request.query?.action
  const action = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] ?? '' : ''

  switch (action) {
    case 'google-start':
      return handleGoogleStart(request, response)
    case 'google-callback':
      return handleGoogleCallback(request, response)
    case 'session':
      return handleSession(request, response)
    case 'logout':
      return handleLogout(request, response)
    default:
      response.status(404).setHeader('Content-Type', 'application/json').json({
        error: 'Unknown auth action',
        hint: 'Use /api/auth/google/start, /api/auth/google/callback, /api/auth/session, or /api/auth/logout.',
        receivedAction: action,
      })
  }
}

// ----- Route: GET /api/auth/google/start ------------------------------------
async function handleGoogleStart(
  request: VercelRequest,
  response: VercelResponse,
): Promise<void> {
  if (request.method && request.method !== 'GET') {
    response.status(405).setHeader('Allow', 'GET').end()
    return
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const missing: string[] = []
  if (!clientId) missing.push('GOOGLE_CLIENT_ID')
  if (!process.env.GOOGLE_CLIENT_SECRET) missing.push('GOOGLE_CLIENT_SECRET')
  if (!process.env.AUTH_JWT_SECRET) missing.push('AUTH_JWT_SECRET')

  if (missing.length > 0 || !clientId) {
    response
      .status(503)
      .setHeader('Content-Type', 'application/json')
      .json({
        error: 'Google sign-in not configured',
        missing,
        hint: 'Set the listed env vars in Vercel (Project → Settings → Environment Variables) and redeploy.',
      })
    return
  }

  const redirectUri = resolveRedirectUri(request)
  const state = randomBytes(24).toString('base64url')
  const next = readNext(request)
  const cookieValue = `${state}|${encodeURIComponent(next)}`
  const secure = isProduction() ? '; Secure' : ''

  const authorizeUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authorizeUrl.searchParams.set('client_id', clientId)
  authorizeUrl.searchParams.set('redirect_uri', redirectUri)
  authorizeUrl.searchParams.set('response_type', 'code')
  authorizeUrl.searchParams.set('scope', 'openid email profile')
  authorizeUrl.searchParams.set('state', state)
  authorizeUrl.searchParams.set('prompt', 'select_account')
  authorizeUrl.searchParams.set('access_type', 'online')

  response
    .status(302)
    .setHeader(
      'Set-Cookie',
      `prophetpicks_oauth_state=${cookieValue}; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=600`,
    )
    .setHeader('Cache-Control', 'no-store')
    .setHeader('Location', authorizeUrl.toString())
    .end()
}

// ----- Route: GET /api/auth/google/callback ---------------------------------
async function handleGoogleCallback(
  request: VercelRequest,
  response: VercelResponse,
): Promise<void> {
  if (request.method && request.method !== 'GET') {
    response.status(405).setHeader('Allow', 'GET').end()
    return
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const jwtSecret = process.env.AUTH_JWT_SECRET

  if (!clientId || !clientSecret || !jwtSecret) {
    sendHtmlError(
      response,
      503,
      'Sign-in not configured',
      'Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and AUTH_JWT_SECRET in Vercel env and redeploy.',
    )
    return
  }

  const code = readQuery(request.query?.code)
  const returnedState = readQuery(request.query?.state)
  if (!code) {
    sendHtmlError(
      response,
      400,
      'Missing code',
      'Google did not return an authorization code.',
    )
    return
  }

  const cookies = parseCookies(request.headers?.cookie)
  const stateCookie = cookies.prophetpicks_oauth_state ?? ''
  const [storedState, encodedNext] = stateCookie.split('|', 2)
  let nextPath = '/'
  try {
    if (encodedNext) {
      const decoded = decodeURIComponent(encodedNext)
      if (decoded.startsWith('/')) {
        nextPath = decoded
      }
    }
  } catch {
    nextPath = '/'
  }

  if (!storedState || storedState !== returnedState) {
    sendHtmlError(
      response,
      400,
      'OAuth state mismatch',
      'The CSRF state did not match. Start sign-in over from /api/auth/google/start.',
    )
    return
  }

  const redirectUri = resolveRedirectUri(request)

  let tokens: GoogleTokenResponse
  try {
    tokens = await exchangeCode({
      code,
      clientId,
      clientSecret,
      redirectUri,
    })
  } catch (error) {
    sendHtmlError(response, 502, 'Token exchange failed', stringifyError(error))
    return
  }

  if (!tokens.access_token) {
    sendHtmlError(
      response,
      502,
      'No access token returned',
      'Google did not return an access token. Check Google Cloud Console credentials.',
    )
    return
  }

  let profile: GoogleUserInfo
  try {
    profile = await fetchProfile(tokens.access_token)
  } catch (error) {
    sendHtmlError(response, 502, 'User info fetch failed', stringifyError(error))
    return
  }

  const userId = profile.sub ?? profile.id
  if (!userId || !profile.email) {
    sendHtmlError(
      response,
      502,
      'Incomplete profile',
      'Google did not return a user id and email.',
    )
    return
  }

  const now = Math.floor(Date.now() / 1000)
  const token = signJwt(
    {
      sub: userId,
      email: profile.email,
      name: profile.name ?? profile.email,
      picture: profile.picture ?? null,
      iat: now,
      exp: now + SESSION_TTL_SECONDS,
    },
    jwtSecret,
  )

  const secure = isProduction() ? '; Secure' : ''

  response
    .status(302)
    .setHeader('Cache-Control', 'no-store')
    .setHeader('Set-Cookie', [
      `prophetpicks_session=${token}; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=${SESSION_TTL_SECONDS}`,
      `prophetpicks_oauth_state=; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=0`,
    ])
    .setHeader('Location', nextPath)
    .end()
}

// ----- Route: GET /api/auth/session -----------------------------------------
async function handleSession(
  request: VercelRequest,
  response: VercelResponse,
): Promise<void> {
  if (request.method && request.method !== 'GET') {
    response.status(405).setHeader('Allow', 'GET').end()
    return
  }

  const secret = process.env.AUTH_JWT_SECRET
  const authConfigured = Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      secret,
  )

  const body: SessionResponse = {
    authProvider: authConfigured ? 'google' : 'disabled',
    user: null,
  }

  if (!authConfigured || !secret) {
    response
      .status(200)
      .setHeader('Cache-Control', 'no-store')
      .setHeader('Content-Type', 'application/json')
      .json(body)
    return
  }

  const cookies = parseCookies(request.headers?.cookie)
  const token = cookies.prophetpicks_session
  if (token) {
    const claims = verifyJwt(token, secret)
    if (claims) {
      body.user = {
        id: String(claims.sub ?? ''),
        email: String(claims.email ?? ''),
        name: String(claims.name ?? ''),
        picture:
          typeof claims.picture === 'string' && claims.picture
            ? claims.picture
            : null,
        provider: 'google',
      }
    }
  }

  response
    .status(200)
    .setHeader('Cache-Control', 'no-store')
    .setHeader('Content-Type', 'application/json')
    .json(body)
}

// ----- Route: GET/POST /api/auth/logout -------------------------------------
async function handleLogout(
  request: VercelRequest,
  response: VercelResponse,
): Promise<void> {
  if (request.method && request.method !== 'POST' && request.method !== 'GET') {
    response.status(405).setHeader('Allow', 'GET, POST').end()
    return
  }

  const secure = isProduction() ? '; Secure' : ''

  response
    .status(200)
    .setHeader(
      'Set-Cookie',
      `prophetpicks_session=; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=0`,
    )
    .setHeader('Cache-Control', 'no-store')
    .setHeader('Content-Type', 'application/json')
    .json({ ok: true })
}

// ----- Shared helpers --------------------------------------------------------

function isProduction(): boolean {
  return process.env.VERCEL_ENV === 'production'
}

function readQuery(value: string | string[] | undefined): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value[0] ?? ''
  return ''
}

function readNext(request: VercelRequest): string {
  const raw = request.query?.next
  const value = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : ''
  if (!value || !value.startsWith('/')) {
    return '/'
  }
  return value
}

function parseCookies(raw: string | string[] | undefined): Record<string, string> {
  const value = Array.isArray(raw) ? raw.join('; ') : raw ?? ''
  const cookies: Record<string, string> = {}
  for (const part of value.split(';')) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim()
    if (key) {
      try {
        cookies[key] = decodeURIComponent(val)
      } catch {
        cookies[key] = val
      }
    }
  }
  return cookies
}

function resolveRedirectUri(request: VercelRequest): string {
  const configured = process.env.AUTH_REDIRECT_URL
  if (configured) {
    return configured
  }
  const host = request.headers?.host ?? 'prophetpicks.vercel.app'
  const proto = request.headers?.['x-forwarded-proto'] ?? 'https'
  return `${proto}://${host}/api/auth/google/callback`
}

async function exchangeCode(args: {
  code: string
  clientId: string
  clientSecret: string
  redirectUri: string
}): Promise<GoogleTokenResponse> {
  const params = new URLSearchParams({
    code: args.code,
    client_id: args.clientId,
    client_secret: args.clientSecret,
    redirect_uri: args.redirectUri,
    grant_type: 'authorization_code',
  })

  const upstream = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: params.toString(),
  })

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => '')
    throw new Error(`Google token endpoint returned ${upstream.status}: ${text}`)
  }

  return (await upstream.json()) as GoogleTokenResponse
}

async function fetchProfile(accessToken: string): Promise<GoogleUserInfo> {
  const upstream = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  })

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => '')
    throw new Error(`Google userinfo returned ${upstream.status}: ${text}`)
  }

  return (await upstream.json()) as GoogleUserInfo
}

function signJwt(payload: Record<string, unknown>, secret: string): string {
  const header = { alg: 'HS256', typ: 'JWT' }
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url')
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url')
  return `${encodedHeader}.${encodedPayload}.${signature}`
}

function verifyJwt(token: string, secret: string): Record<string, unknown> | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [encodedHeader, encodedPayload, encodedSignature] = parts

  const expected = createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest()
  const provided = Buffer.from(encodedSignature, 'base64url')
  if (expected.length !== provided.length) return null
  if (!timingSafeEqual(expected, provided)) return null

  try {
    const claims = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf-8'),
    ) as Record<string, unknown>
    if (typeof claims.exp === 'number' && claims.exp < Math.floor(Date.now() / 1000)) {
      return null
    }
    return claims
  } catch {
    return null
  }
}

function stringifyError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}

function sendHtmlError(
  response: VercelResponse,
  status: number,
  title: string,
  detail: string,
): void {
  const safeTitle = escapeHtml(title)
  const safeDetail = escapeHtml(detail)
  response
    .status(status)
    .setHeader('Content-Type', 'text/html; charset=utf-8')
    .setHeader('Cache-Control', 'no-store')
    .send(
      `<!doctype html><html><head><meta charset="utf-8"><title>${safeTitle}</title>` +
        `<style>body{font-family:Inter,system-ui,sans-serif;background:#f5f6f8;padding:48px;color:#0f1419}` +
        `main{max-width:520px;margin:0 auto;padding:24px;background:#fff;border:1px solid #e3e6ea;border-radius:8px}` +
        `h1{margin:0 0 8px;font-size:18px}p{margin:0 0 12px;font-size:13px;line-height:1.5}` +
        `a{color:#1493ff;text-decoration:none}</style></head>` +
        `<body><main><h1>${safeTitle}</h1><p>${safeDetail}</p>` +
        `<p><a href="/">← Back to ProphetPicks</a></p></main></body></html>`,
    )
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
