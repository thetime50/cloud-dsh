import { timingSafeEqual } from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Duplex } from 'node:stream'
import type { Config } from './config.ts'
import { HttpError } from './errors.ts'
import type { Launcher } from './launcher.ts'
import { listMarketApps } from './market.ts'
import { confirmAccess, readCookie } from './playsite.ts'
import { matchInstancePath, proxyHttp, proxyUpgrade } from './proxy.ts'

export type Gateway = {
  port: number
  close(): Promise<void>
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const raw = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(raw),
  })
  res.end(raw)
}

function sendText(res: ServerResponse, status: number, message: string): void {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' })
  res.end(message)
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > 1024 * 1024) throw new HttpError(413, '请求过大')
    chunks.push(buffer)
  }
  return Buffer.concat(chunks).toString('utf8')
}

function bearerOk(req: IncomingMessage, token: string): boolean {
  const header = req.headers.authorization || ''
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header)
  const got = match?.[1] || ''
  const left = Buffer.from(got)
  const right = Buffer.from(token)
  if (left.length === 0 || left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

function localDevHost(host: string | undefined): boolean {
  const raw = host || ''
  const name = raw.startsWith('[') ? raw.slice(1, raw.indexOf(']')) : raw.split(':')[0]
  return name === 'localhost' || name === '127.0.0.1' || name === '::1'
}

function latestWebToken(profileDir: string): string {
  const logPath = path.join(profileDir, 'dsh.log')
  let text = ''
  try {
    const stat = fs.statSync(logPath)
    const length = Math.min(stat.size, 8192)
    const fd = fs.openSync(logPath, 'r')
    const buffer = Buffer.alloc(length)
    fs.readSync(fd, buffer, 0, length, Math.max(0, stat.size - length))
    fs.closeSync(fd)
    text = buffer.toString('utf8')
  } catch {
    return ''
  }
  let token = ''
  for (const match of text.matchAll(/[?&]token=([A-Za-z0-9_-]+)/g)) token = match[1] || ''
  return token
}

function entryLocation(reqUrl: string, prefix: string, token: string): string | null {
  const url = new URL(reqUrl || '/', 'http://127.0.0.1')
  if (url.searchParams.has('token')) return null
  if (url.pathname !== prefix && url.pathname !== `${prefix}/`) return null
  url.searchParams.set('token', token)
  return `${url.pathname}${url.search}`
}

function rejectUpgrade(socket: Duplex, status: number): void {
  const reason = status === 401 ? 'Unauthorized' : 'Forbidden'
  socket.write(`HTTP/1.1 ${status} ${reason}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`)
  socket.end()
}

async function handleInstances(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  launcher: Launcher,
  llmKey: string,
  baseParts: string[],
): Promise<void> {
  const relative = url.pathname.split('/').filter(Boolean).slice(baseParts.length)
  if (req.method === 'GET' && relative.length === 1 && relative[0] === 'instances') {
    sendJson(res, 200, launcher.list())
    return
  }
  if (req.method === 'POST' && relative.length === 1 && relative[0] === 'instances') {
    const raw = await readBody(req)
    const body = raw ? JSON.parse(raw) as { id?: string } : {}
    const row = await launcher.create(body.id, llmKey)
    sendJson(res, 201, row)
    return
  }
  const id = relative[1] || ''
  if (relative[0] === 'instances' && id && relative.length === 2 && req.method === 'DELETE') {
    sendJson(res, 200, await launcher.remove(id))
    return
  }
  if (relative[0] === 'instances' && id && relative[2] === 'stop' && req.method === 'POST') {
    sendJson(res, 200, await launcher.stop(id))
    return
  }
  if (relative[0] === 'instances' && id && relative[2] === 'start' && req.method === 'POST') {
    sendJson(res, 200, await launcher.start(id, llmKey))
    return
  }
  sendText(res, 404, '未找到')
}

function proxyManage(req: IncomingMessage, res: ServerResponse, origin: string): void {
  const target = new URL(req.url || '/manage/', origin)
  const headers = { ...req.headers, host: target.host }
  const upstream = http.request(target, { method: req.method, headers }, (up) => {
    res.writeHead(up.statusCode || 502, up.headers)
    up.pipe(res)
  })
  upstream.on('error', () => {
    if (!res.headersSent) sendText(res, 502, '管理页不可达')
    else res.end()
  })
  req.pipe(upstream)
}

export async function startGateway(config: Config, launcher: Launcher): Promise<Gateway> {
  async function handleAdmin(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
    if (!config.adminToken) {
      sendText(res, 503, '未配置管理令牌')
      return
    }
    if (!bearerOk(req, config.adminToken)) {
      sendText(res, 401, '管理令牌无效')
      return
    }
    await handleInstances(req, res, url, launcher, config.defaultLlmKey, ['admin'])
  }

  async function handleManage(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
    if (url.pathname === '/manage/api/apps' || url.pathname === '/manage/api/apps/') {
      if (req.method !== 'GET') {
        sendText(res, 404, '未找到')
        return
      }
      sendJson(res, 200, listMarketApps(config.appsDir).map((app) => ({
        id: app.id,
        name: app.name,
        kind: app.kind,
        description: app.description,
      })))
      return
    }
    if (url.pathname === '/manage/api' || url.pathname.startsWith('/manage/api/')) {
      await handleInstances(req, res, url, launcher, config.defaultLlmKey, ['manage', 'api'])
      return
    }
    if (!config.manageOrigin) {
      sendText(res, 503, '未配置 CLOUD_DSH_MANAGE_ORIGIN')
      return
    }
    proxyManage(req, res, config.manageOrigin)
  }

  async function openInstance(req: IncomingMessage, id: string) {
    if (config.devOpen && localDevHost(req.headers.host)) {
      return launcher.ensure(id, config.defaultLlmKey)
    }
    const token = readCookie(req.headers.cookie, 'play_site_token')
    const decision = await confirmAccess(config, id, token)
    if (!decision.ok) {
      const message = decision.status === 401 ? '未登录' : decision.status === 502 ? '主站不可达' : '主站未通过'
      throw new HttpError(decision.status, message)
    }
    return launcher.ensure(id, decision.llmKey || config.defaultLlmKey)
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1')
    try {
      if (url.pathname === '/manage' || url.pathname.startsWith('/manage/')) {
        await handleManage(req, res, url)
        return
      }
      if (url.pathname === '/admin' || url.pathname.startsWith('/admin/')) {
        await handleAdmin(req, res, url)
        return
      }
      const instance = matchInstancePath(req.url)
      if (!instance) {
        sendText(res, 404, '未找到')
        return
      }
      const row = await openInstance(req, instance.id)
      if (!row.port) throw new HttpError(503, '实例未监听')
      const cookie = Array.isArray(req.headers.cookie) ? req.headers.cookie.join(';') : (req.headers.cookie || '')
      if (req.method === 'GET' && !cookie.includes('dsh-auth-')) {
        const token = latestWebToken(row.profile_dir)
        const location = token ? entryLocation(req.url || '/', instance.prefix, token) : null
        if (location) {
          res.writeHead(302, { location, 'cache-control': 'no-store' })
          res.end()
          return
        }
      }
      proxyHttp(req, res, row.port, instance.prefix)
    } catch (error) {
      const status = error instanceof HttpError ? error.status : error instanceof SyntaxError ? 400 : 500
      const message = error instanceof Error ? error.message : '内部错误'
      if (!res.headersSent) sendText(res, status, message)
      else res.end()
    }
  })

  server.on('upgrade', (req, socket, head) => {
    const instance = matchInstancePath(req.url)
    if (!instance) {
      rejectUpgrade(socket, 404)
      return
    }
    void openInstance(req, instance.id).then((row) => {
      if (!row.port) {
        rejectUpgrade(socket, 503)
        return
      }
      proxyUpgrade(req, socket, head, row.port, instance.prefix)
    }).catch((error: unknown) => {
      const status = error instanceof HttpError ? error.status : 500
      rejectUpgrade(socket, status)
    })
  })

  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => reject(error)
    server.once('error', onError)
    server.listen(config.gatewayPort, config.gatewayHost, () => {
      server.off('error', onError)
      resolve()
    })
  })
  const address = server.address()
  const port = address && typeof address === 'object' ? address.port : config.gatewayPort
  return {
    port,
    close() {
      return new Promise((resolve) => {
        const timer = setTimeout(resolve, 250)
        server.close(() => {
          clearTimeout(timer)
          resolve()
        })
        server.closeAllConnections()
      })
    },
  }
}
