/**
 * GET /api/auth/session — returns the signed-in user from the cookie.
 *
 * Self-contained HS256 JWT verifier via Node's crypto module so the
 * function has no external dependencies. Returns { user: null } when
 * the cookie is missing or the JWT is invalid/expired.
 */

import { createHmac, timingSafeEqual } from 'node:crypto'

interface VercelRequest {
  method?: string
  headers?: { cookie?: string | string[] }
}

interface VercelResponse {
  status: (code: number) => VercelResponse
  setHeader: (name: string, value: string | string[]) => VercelResponse
  json: (body: unknown) => void
  end: () => void
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

export default async function handler(
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
