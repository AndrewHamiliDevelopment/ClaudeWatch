import { EventEmitter } from 'node:events'
import type { BridgePoller } from '../bridge/poller'
import type { BridgeProcess } from '../main/bridge-host'

// The bridge poller run in this process, shaped like the utility process the app forks, so
// one BridgeHost restarts and folds either.
export class PollerProcess extends EventEmitter implements BridgeProcess {
  private stopPolling: (() => void) | null = null
  private isKilled = false

  constructor(poller: Pick<BridgePoller, 'start'>) {
    super()
    poller
      .start((message) => {
        if (!this.isKilled) this.emit('message', message)
      })
      .then(
        (stopPolling) => {
          if (this.isKilled) stopPolling()
          else this.stopPolling = stopPolling
        },
        () => {
          if (!this.isKilled) this.emit('exit', 1)
        }
      )
  }

  kill(): boolean {
    this.isKilled = true
    this.stopPolling?.()
    this.stopPolling = null
    return true
  }
}
