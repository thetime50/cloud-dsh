import crypto from 'node:crypto'
import http from 'node:http'

const args = process.argv.slice(2)
let port = 0
for (let index = 0; index < args.length; index += 1) {
  if (args[index] === '--port') port = Number(args[index + 1] || 0)
}
if (!port) {
  process.stderr.write('missing port\n')
  process.exit(1)
}

const instance = process.env.CLOUD_DSH_INSTANCE_ID || ''
const llm = process.env.DEEPSEEK_API_KEY ? 'set' : 'missing'
const server = http.createServer((_req, res) => {
  const html = `<!doctype html><head><title>dsh</title></head><body>stub-dsh instance=${instance} llm=${llm}</body>`
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
  res.end(html)
})

server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key']
  if (!key) {
    socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n')
    return
  }
  const accept = crypto.createHash('sha1').update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64')
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`)
})

server.listen(port, '127.0.0.1', () => {
  const exitAfter = Number(process.env.CLOUD_DSH_STUB_EXIT_AFTER_MS || 0)
  if (exitAfter > 0) setTimeout(() => process.exit(0), exitAfter)
})
