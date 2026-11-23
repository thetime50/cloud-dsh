import { spawnSync } from 'node:child_process'

export function pidAlive(pid: number | null | undefined): boolean {
  if (!pid || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

export function killPid(pid: number | null | undefined): void {
  if (!pid || pid <= 0) return
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(pid), '/t', '/f'], { windowsHide: true, stdio: 'ignore' })
    return
  }
  try {
    process.kill(pid, 'SIGKILL')
  } catch {
    // 进程已经退出
  }
}
