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

function sendJson(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(payload))
}

export function startMock(bindings) {
  const approved = { instanceIds: [] }
  const server = http.createServer(async (req, res) => {
    const pathname = (req.url || '').split('?')[0]
    if (req.method !== 'POST' || !pathname.startsWith('/api/internal/dsh/')) {
      res.writeHead(404)
      res.end()
      return
    }
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
    if (pathname.startsWith('/api/internal/dsh/instances')) {
      if (!bindings) {
        sendJson(res, 200, { ok: true, userId: 'mock-user', instanceIds: approved.instanceIds })
        return
      }
      const token = tokenFrom(req.headers.cookie)
      const entry = bindings[token]
      if (!entry) {
        sendJson(res, 401, { ok: false })
        return
      }
      sendJson(res, 200, { ok: true, userId: entry.userId, instanceIds: entry.instanceIds })
      return
    }
    if (!pathname.startsWith('/api/internal/dsh/access')) {
      res.writeHead(404)
      res.end()
      return
    }
    if (!bindings) {
      sendJson(res, 200, { ok: true, userId: 'mock-user', llmKey: '' })
      return
    }
    const token = tokenFrom(req.headers.cookie)
    const entry = bindings[token]
    const allowed = Boolean(entry && entry.instanceIds.includes(body.instanceId))
    const status = !entry ? 401 : allowed ? 200 : 403
    const payload = allowed
      ? { ok: true, userId: entry.userId, llmKey: entry.llmKey || '' }
      : { ok: false }
    sendJson(res, status, payload)
  })
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = address && typeof address === 'object' ? address.port : 0
      resolve({
        url: `http://127.0.0.1:${port}`,
        setInstances(instanceIds) {
          approved.instanceIds = instanceIds.slice()
        },
        close: () => new Promise((done) => {
          server.closeAllConnections()
          server.close(() => done())
        }),
      })
    })
  })
}
