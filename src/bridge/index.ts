import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import type { FeedMessage } from '../shared/office/types'
import { BridgePoller } from './poller'

interface BridgePort {
  postMessage(message: FeedMessage): void
}

const ONCE_MAX_TICKS = 30

export async function main(args = process.argv.slice(2), port?: BridgePort): Promise<void> {
  const roots = [join(homedir(), '.claude')]
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--root' && args[index + 1]) roots.push(resolve(args[++index]))
  }
  const poller = new BridgePoller({ claudeRoots: roots })
  if (args.includes('--once')) {
    // The first tick publishes before any transcript is counted; a one-shot run wants the numbers.
    let snapshot = await poller.tick()
    for (let ticks = 1; poller.isCountingUsage && ticks < ONCE_MAX_TICKS; ticks++)
      snapshot = await poller.tick()
    process.stdout.write(`${JSON.stringify(snapshot)}\n`)
    return
  }
  if (port) await poller.start((message) => port.postMessage(message))
}

const port = (process as NodeJS.Process & { parentPort?: BridgePort }).parentPort
if (port || process.argv.includes('--once')) {
  void main(process.argv.slice(2), port).catch(() => {
    process.stderr.write('Office bridge failed\n')
    process.exitCode = 1
  })
}
