import { spawn } from 'node:child_process'
import { defineTool } from '@deepseek-ai/dsh-tools'

export const name = 'cloud-dsh-sandbox-tools'
export const inject = ['tools']

const output = {
  schema: { type: 'string' },
  render: (_args, value) => [{ type: 'text', text: String(value) }],
}

const allow = ['python', 'node', 'shell', 'file_read', 'file_write']

function contextArgs(exec) {
  const args = []
  const sessionId = exec?.sessionId || exec?.session?.id || ''
  const agentId = exec?.agentId || ''
  const taskId = exec?.taskId || ''
  const traceId = exec?.traceId || ''
  if (sessionId) args.push('--session', String(sessionId))
  if (agentId) args.push('--agent', String(agentId))
  if (taskId) args.push('--task', String(taskId))
  if (traceId) args.push('--trace', String(traceId))
  return args
}

function sandboxEnv() {
  return {
    CLOUD_DSH_DB: process.env.CLOUD_DSH_DB || '',
    CLOUD_DSH_SANDBOX_LOG: process.env.CLOUD_DSH_SANDBOX_LOG || '',
    CLOUD_DSH_SANDBOX_PATH: process.env.CLOUD_DSH_SANDBOX_PATH || process.env.PATH || '',
    CLOUD_DSH_RUNTIME: process.env.CLOUD_DSH_RUNTIME || '',
    CLOUD_DSH_UV: process.env.CLOUD_DSH_UV || 'uv',
    CLOUD_DSH_USER_ID: process.env.CLOUD_DSH_USER_ID || '',
    LANG: process.env.LANG || 'C.UTF-8',
    PATH: process.env.PATH || '',
    SYSTEMROOT: process.env.SYSTEMROOT,
    PATHEXT: process.env.PATHEXT,
    COMSPEC: process.env.COMSPEC,
  }
}

function run(args, input) {
  const bin = process.env.CLOUD_DSH_SANDBOX_BIN
  const instanceId = process.env.CLOUD_DSH_INSTANCE_ID
  if (!bin || !instanceId) return Promise.resolve('沙箱未配置')
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [
      '--experimental-strip-types',
      bin,
      '--instance',
      instanceId,
      '--timeout',
      '30s',
      ...args,
    ], {
      env: sandboxEnv(),
      windowsHide: true,
    })
    let text = ''
    const cap = 1024 * 1024
    const take = (chunk) => {
      if (text.length >= cap) return
      text += chunk.toString('utf8').slice(0, cap - text.length)
    }
    child.stdout?.on('data', take)
    child.stderr?.on('data', take)
    child.on('error', (error) => resolve(error.message))
    child.on('close', (code) => resolve(text || `exit ${code}`))
    child.stdin?.end(input ?? '')
  })
}

export function apply(ctx) {
  ctx.tools.register(defineTool({
    name: 'python',
    description: '在当前实例沙箱里执行 Python。工作根是该实例的 files/。',
    parameters: {
      code: { type: 'string', required: true, description: 'Python 源码' },
    },
    output,
    execute(args, exec) {
      return run([...contextArgs(exec), '--', 'py', '-c', args.code], '')
    },
  }))
  ctx.tools.register(defineTool({
    name: 'node',
    description: '在当前实例沙箱里执行 Node.js。工作根是该实例的 files/。',
    parameters: {
      code: { type: 'string', required: true, description: 'JavaScript 源码' },
    },
    output,
    execute(args, exec) {
      return run([...contextArgs(exec), '--', 'node', '-e', args.code], '')
    },
  }))
  ctx.tools.register(defineTool({
    name: 'shell',
    description: '在当前实例沙箱里执行 Shell。工作根是该实例的 files/。',
    parameters: {
      script: { type: 'string', required: true, description: 'Shell 脚本' },
    },
    output,
    execute(args, exec) {
      return run([...contextArgs(exec), '--', 'sh', '-c', args.script], '')
    },
  }))
  ctx.tools.register(defineTool({
    name: 'file_read',
    description: '读取当前实例 files/ 里的文件。',
    parameters: {
      path: { type: 'string', required: true, description: '相对 files/ 的路径' },
    },
    output,
    execute(args, exec) {
      return run([...contextArgs(exec), '--', 'file', 'read', args.path], '')
    },
  }))
  ctx.tools.register(defineTool({
    name: 'file_write',
    description: '把内容写入当前实例 files/。files/ 以外的路径会被拒绝。',
    parameters: {
      path: { type: 'string', required: true, description: '相对 files/ 的路径' },
      content: { type: 'string', required: true, description: '文件内容' },
    },
    output,
    execute(args, exec) {
      return run([...contextArgs(exec), '--', 'file', 'write', args.path], args.content)
    },
  }))
  if (typeof ctx.tools.restrict === 'function') {
    ctx.tools.restrict({ allow })
  }
}
