import http from 'node:http'

const port = Number(process.env.PORT || 3001)
const gateway = (process.env.CLOUD_DSH_GATEWAY_URL || 'http://127.0.0.1:8080').replace(/\/$/, '')
const adminToken = process.env.CLOUD_DSH_ADMIN_TOKEN || ''

function send(res, status, body, type) {
  const raw = typeof body === 'string' ? body : JSON.stringify(body)
  res.writeHead(status, {
    'content-type': type || 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(raw),
  })
  res.end(raw)
}

function page(rows, notice) {
  const list = rows.map((row) => {
    const id = String(row.id)
    return `<li>${escapeHtml(id)} ${escapeHtml(row.status || '')}
      <form method="post" action="/instances/delete" style="display:inline">
        <input type="hidden" name="id" value="${escapeHtml(id)}">
        <button type="submit">删除</button>
      </form>
    </li>`
  }).join('')
  const html = `<!doctype html>
<meta charset="utf-8">
<title>模拟主站</title>
<main>
  <h1>模拟主站</h1>
  <p>${escapeHtml(notice || '')}</p>
  <form method="post" action="/instances">
    <input name="id" placeholder="可选实例 id">
    <button type="submit">创建</button>
  </form>
  <ul>${list || '<li>暂无实例</li>'}</ul>
</main>`
  return html
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

async function readForm(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf8')
  return new URLSearchParams(raw)
}

async function admin(method, pathname, body) {
  const res = await fetch(`${gateway}${pathname}`, {
    method,
    headers: {
      authorization: `Bearer ${adminToken}`,
      'content-type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let data = text
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    /* keep text */
  }
  if (!res.ok) {
    const message = typeof data === 'string' ? data : text || `HTTP ${res.status}`
    throw new Error(message)
  }
  return data
}

async function render(res, notice) {
  let rows = []
  try {
    const data = await admin('GET', '/admin/instances')
    rows = Array.isArray(data) ? data : []
  } catch (error) {
    notice = error instanceof Error ? error.message : String(error)
  }
  send(res, 200, page(rows, notice), 'text/html; charset=utf-8')
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1')
  try {
    if (req.method === 'POST' && url.pathname === '/api/internal/dsh/access') {
      send(res, 200, { ok: true, userId: 'mock-user', llmKey: '' })
      return
    }
    if (req.method === 'POST' && url.pathname === '/api/internal/dsh/instances') {
      const data = await admin('GET', '/admin/instances')
      const instanceIds = Array.isArray(data) ? data.map((row) => String(row.id)) : []
      send(res, 200, { ok: true, userId: 'mock-user', instanceIds })
      return
    }
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '')) {
      await render(res, '')
      return
    }
    if (req.method === 'POST' && url.pathname === '/instances') {
      const form = await readForm(req)
      const id = String(form.get('id') || '').trim()
      await admin('POST', '/admin/instances', id ? { id } : {})
      res.writeHead(303, { location: '/' })
      res.end()
      return
    }
    if (req.method === 'POST' && url.pathname === '/instances/delete') {
      const form = await readForm(req)
      const id = String(form.get('id') || '').trim()
      await admin('DELETE', `/admin/instances/${encodeURIComponent(id)}`)
      res.writeHead(303, { location: '/' })
      res.end()
      return
    }
    send(res, 404, '未找到', 'text/plain; charset=utf-8')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await render(res, message).catch(() => {
      send(res, 500, message, 'text/plain; charset=utf-8')
    })
  }
})

server.listen(port, '0.0.0.0', () => {
  console.log(`mock-play-site listening ${port}`)
})
