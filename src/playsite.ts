import type { Config } from './config.ts'

export type AccessDecision = {
  ok: true
  userId: string
  llmKey: string
} | {
  ok: false
  status: number
}

export async function confirmAccess(config: Config, instanceId: string, token: string): Promise<AccessDecision> {
  if (!token) return { ok: false, status: 401 }
  const url = new URL(config.playSiteAccessPath, config.playSiteUrl)
  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: `play_site_token=${encodeURIComponent(token)}`,
      },
      body: JSON.stringify({ instanceId }),
      signal: AbortSignal.timeout(config.playSiteTimeoutMs),
    })
  } catch {
    return { ok: false, status: 502 }
  }
  if (response.status === 401) return { ok: false, status: 401 }
  if (!response.ok) return { ok: false, status: 403 }
  const body = await response.json().catch(() => null) as { ok?: boolean, userId?: string, llmKey?: string } | null
  if (!body?.ok) return { ok: false, status: 403 }
  return {
    ok: true,
    userId: String(body.userId || ''),
    llmKey: body.llmKey ? String(body.llmKey) : '',
  }
}

export function readCookie(header: string | undefined, name: string): string {
  if (!header) return ''
  for (const part of header.split(';')) {
    const text = part.trim()
    const index = text.indexOf('=')
    if (index <= 0) continue
    if (text.slice(0, index) !== name) continue
    return decodeURIComponent(text.slice(index + 1))
  }
  return ''
}
