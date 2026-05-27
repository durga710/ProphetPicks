/**
 * POST/GET /api/auth/logout — clear the session cookie.
 *
 * Self-contained: cookie attributes match what callback.ts writes so
 * browsers actually evict it.
 */

interface VercelRequest {
  method?: string
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
  if (request.method && request.method !== 'POST' && request.method !== 'GET') {
    response.status(405).setHeader('Allow', 'GET, POST').end()
    return
  }

  const secure = process.env.VERCEL_ENV === 'production' ? '; Secure' : ''

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
