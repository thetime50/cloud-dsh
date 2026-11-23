import http from 'node:http'
import net from 'node:net'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Duplex } from 'node:stream'

const PREFIX_MARK = 'data-cloud-dsh="prefix"'

export function matchInstancePath(url: string | undefined): { id: string, prefix: string } | null {
  const pathname = (url || '/').split('?')[0] || '/'
  const match = /^\/i\/([A-Za-z0-9_-]+)(\/.*)?$/.exec(pathname)
  if (!match) return null
  return { id: match[1] || '', prefix: `/i/${match[1]}` }
}

export function upstreamPath(url: string, prefix: string): string {
  const queryIndex = url.indexOf('?')
  const pathname = queryIndex >= 0 ? url.slice(0, queryIndex) : url
  const search = queryIndex >= 0 ? url.slice(queryIndex) : ''
  let rest = pathname.slice(prefix.length)
  if (!rest) rest = '/'
  if (!rest.startsWith('/')) rest = `/${rest}`
  return rest + search
}

function rewriteHeaders(headers: http.IncomingHttpHeaders, prefix: string): http.OutgoingHttpHeaders {
  const next: http.OutgoingHttpHeaders = { ...headers }
  const location = next.location
  if (typeof location === 'string' && location.startsWith('/') && !location.startsWith(`${prefix}/`) && location !== prefix) {
    next.location = prefix + location
  }
  return next
}

function injectPrefix(html: string, prefix: string): string {
  if (html.includes(PREFIX_MARK)) return html
  const script = `<script ${PREFIX_MARK}>(function(){var p=${JSON.stringify(prefix)};function fix(u){if(typeof u!=="string"||u.charAt(0)!=="/"||u===p||u.indexOf(p+"/")===0)return u;return p+u;}var f=window.fetch;if(f)window.fetch=function(i,n){if(typeof i==="string")i=fix(i);return f.call(this,i,n);};var X=window.XMLHttpRequest&&window.XMLHttpRequest.prototype.open;if(X)window.XMLHttpRequest.prototype.open=function(m,u){return X.call(this,m,fix(u),arguments[2],arguments[3],arguments[4]);};var W=window.WebSocket;if(W){var Wrapped=function(u,proto){try{var x=new URL(u,location.href);if(x.origin===location.origin){var n=fix(x.pathname);if(n!==x.pathname){x.pathname=n;u=x.toString();}}}catch(e){}return new W(u,proto);};Wrapped.prototype=W.prototype;window.WebSocket=Wrapped;}})();</script>`
  if (html.includes('<head>')) return html.replace('<head>', `<head>${script}`)
  return script + html
}

function forwardHeaders(req: IncomingMessage, port: number): http.OutgoingHttpHeaders {
  const headers: http.OutgoingHttpHeaders = { ...req.headers, host: `127.0.0.1:${port}` }
  delete headers.cookie
  delete headers.authorization
  delete headers['x-user-id']
  headers['accept-encoding'] = 'identity'
  return headers
}

export function proxyHttp(req: IncomingMessage, res: ServerResponse, port: number, prefix: string): void {
  const target = upstreamPath(req.url || '/', prefix)
  const upstream = http.request({
    hostname: '127.0.0.1',
    port,
    method: req.method,
    path: target,
    headers: forwardHeaders(req, port),
  }, (upstreamResponse) => {
    const type = String(upstreamResponse.headers['content-type'] || '')
    if (!type.includes('text/html')) {
      const headers = rewriteHeaders(upstreamResponse.headers, prefix)
      res.writeHead(upstreamResponse.statusCode || 502, headers)
      upstreamResponse.pipe(res)
      return
    }
    const chunks: Buffer[] = []
    upstreamResponse.on('data', (chunk: Buffer) => chunks.push(chunk))
    upstreamResponse.on('end', () => {
      const html = injectPrefix(Buffer.concat(chunks).toString('utf8'), prefix)
      const headers = rewriteHeaders(upstreamResponse.headers, prefix)
      delete headers['content-length']
      delete headers['content-encoding']
      delete headers['transfer-encoding']
      headers['content-length'] = Buffer.byteLength(html)
      res.writeHead(upstreamResponse.statusCode || 200, headers)
      res.end(html)
    })
  })
  upstream.on('error', () => {
    if (!res.headersSent) res.writeHead(502)
    res.end('上游不可用')
  })
  req.pipe(upstream)
}

export function proxyUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer, port: number, prefix: string): void {
  const target = upstreamPath(req.url || '/', prefix)
  const upstream = net.connect(port, '127.0.0.1')
  const lines = [
    `GET ${target} HTTP/1.1`,
    `Host: 127.0.0.1:${port}`,
    'Connection: Upgrade',
    `Upgrade: ${req.headers.upgrade || 'websocket'}`,
  ]
  for (const [key, value] of Object.entries(req.headers)) {
    if (/^(host|connection|upgrade)$/i.test(key)) continue
    if (/^(cookie|authorization|x-user-id)$/i.test(key)) continue
    const values = Array.isArray(value) ? value : [value]
    for (const item of values) {
      if (item != null) lines.push(`${key}: ${item}`)
    }
  }
  lines.push('', '')
  upstream.on('connect', () => {
    upstream.write(lines.join('\r\n'))
    if (head.length) upstream.write(head)
    upstream.pipe(socket)
    socket.pipe(upstream)
  })
  upstream.on('error', () => socket.destroy())
  socket.on('error', () => upstream.destroy())
}
