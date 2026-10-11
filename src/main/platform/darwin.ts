import { execFilePromise } from './exec'

export interface RawProcessInfo {
  pid: number
  stat: string
  cpuPercent: number
  memPercent: number
  elapsedTime: string
  tty: string
  command: string
}

export interface PlatformDetector {
  getClaudeProcesses(): Promise<RawProcessInfo[]>
  getWorkingDirectory(pid: number): Promise<string>
}

function isClaudeCLI(command: string): boolean {
  // Exclude Claude.app GUI and Electron helper processes
  if (command.includes('Claude.app')) return false
  if (command.includes('Electron.app')) return false
  if (command.includes('Electron Helper')) return false
  if (command.startsWith('grep ')) return false
  // Match: bare "claude" command, or full path ending in /claude
  return /(?:^|\/)claude(\s|$)/.test(command)
}

function parsePsLine(line: string): RawProcessInfo | null {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('PID')) return null

  // Parse: PID STAT %CPU %MEM ELAPSED TT COMMAND...
  // Fields are whitespace-separated, but COMMAND may contain spaces
  const match = trimmed.match(/^(\d+)\s+(\S+)\s+(\d+\.?\d*)\s+(\d+\.?\d*)\s+(\S+)\s+(\S+)\s+(.+)$/)
  if (!match) return null

  const [, pid, stat, cpu, mem, elapsed, tty, command] = match

  if (!isClaudeCLI(command)) return null

  return {
    pid: parseInt(pid, 10),
    stat,
    cpuPercent: parseFloat(cpu),
    memPercent: parseFloat(mem),
    elapsedTime: elapsed,
    tty,
    command
  }
}

function parseLsofOutput(stdout: string): string {
  // lsof -Fn output: lines starting with 'n' contain the filename (cwd)
  const lines = stdout.split('\n')
  for (const line of lines) {
    if (line.startsWith('n') && !line.startsWith('n/dev')) {
      return line.slice(1)
    }
  }
  return ''
}

export class DarwinDetector implements PlatformDetector {
  async getClaudeProcesses(): Promise<RawProcessInfo[]> {
    try {
      const { stdout } = await execFilePromise('ps', [
        '-eo',
        'pid,stat,%cpu,%mem,etime,tty,command'
      ])

      const lines = stdout.split('\n')
      const processes: RawProcessInfo[] = []

      for (const line of lines) {
        const info = parsePsLine(line)
        if (info) {
          processes.push(info)
        }
      }

      return processes
    } catch {
      return []
    }
  }

  async getWorkingDirectory(pid: number): Promise<string> {
    try {
      const { stdout } = await execFilePromise('lsof', [
        '-p',
        String(pid),
        '-a',
        '-d',
        'cwd',
        '-Fn'
      ])
      return parseLsofOutput(stdout)
    } catch {
      return ''
    }
  }
}
