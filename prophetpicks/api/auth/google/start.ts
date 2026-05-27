/**
 * GET /api/auth/google/start — kicks off the Google OAuth dance.
 *
 * Generates a random CSRF `state`, stashes it in a 10-minute httpOnly
 * cookie, then 302s to Google's consent screen. The matching callback
 * route validates the cookie against the returned state.
 *
 * Required env vars (route returns 503 with a helpful message when
 * any are missing so the operator knows what's left to configure):
 *   - GOOGLE_CLIENT_ID
 *   - GOOGLE_CLIENT_SECRET    (used by callback, checked here too so
 *                              the operator gets one clear error)
 *   - AUTH_JWT_SECRET         (same reason)
 *   - AUTH_REDIRECT_URL       (optional; auto-derived from request host
 *                              when absent)
 */

import { randomBytes } from 'node:crypto'

interface VercelRequest {
  method?: string
  headers?: { host?: string; 'x-forwarded-proto'?: string }
  query?: Record<string, string | string[] | undefined>
}

interface VercelResponse {
  status: (code: number) => VercelResponse
  setHeader: (name: string, value: string | string[]) => VercelResponse
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
  const secure = process.env.VERCEL_ENV === 'production' ? '; Secure' : ''

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

function resolveRedirectUri(request: VercelRequest): string {
  const configured = process.env.AUTH_REDIRECT_URL
  if (configured) {
    return configured
  }
  const host = request.headers?.host ?? 'prophetpicks.vercel.app'
  const proto = request.headers?.['x-forwarded-proto'] ?? 'https'
  return `${proto}://${host}/api/auth/google/callback`
}

function readNext(request: VercelRequest): string {
  const raw = request.query?.next
  const value = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : ''
  if (!value || !value.startsWith('/')) {
    return '/'
  }
  return value
}
