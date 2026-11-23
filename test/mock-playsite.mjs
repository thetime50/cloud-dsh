import http from 'node:http'

function tokenFrom(cookie) {
  for (const part of String(cookie || '').split(';')) {
    const text = part.trim()
    const index = text.indexOf('=')
    if (index <= 0) continue
    if (text.slice(0, index) !== 'play_site_token') continue
    return decodeURIComponent(text.slice(index + 1))
  }
  return ''
}

export function startMock(bindings) {
  const server = http.createServer(async (req, res) => {
    if (req.method !== 'POST' || !(req.url || '').startsWith('/api/internal/dsh/access')) {
      res.writeHead(404)
      res.end()
      return
    }
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
    const token = tokenFrom(req.headers.cookie)
    const entry = bindings[token]
    const allowed = Boolean(entry && entry.instanceIds.includes(body.instanceId))
    const status = !entry ? 401 : allowed ? 200 : 403
    const payload = allowed
      ? { ok: true, userId: entry.userId, llmKey: entry.llmKey || '' }
      : { ok: false }
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify(payload))
  })
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = address && typeof address === 'object' ? address.port : 0
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise((done) => {
          server.closeAllConnections()
          server.close(() => done())
        }),
      })
    })
  })
}
