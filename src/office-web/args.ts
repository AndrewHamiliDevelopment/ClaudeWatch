export interface ServerArgs {
  // 0 lets the system pick a free port.
  port: number
  // Off by default: a view-only page can watch and jump, never type into a terminal.
  interactive: boolean
}

const MAX_PORT = 65535

// Null for anything not understood: a mistyped switch must not start a server by guesswork.
export function parseArgs(argv: readonly string[]): ServerArgs | null {
  const args: ServerArgs = { port: 0, interactive: false }
  for (let index = 0; index < argv.length; index++) {
    if (argv[index] === '--interactive') {
      args.interactive = true
    } else if (argv[index] === '--port' && /^\d{1,5}$/.test(argv[index + 1] ?? '')) {
      args.port = Number(argv[++index])
      if (args.port > MAX_PORT) return null
    } else {
      return null
    }
  }
  return args
}
