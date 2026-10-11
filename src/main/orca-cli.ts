import { assertOrcaTrusted, ORCA_APP, ORCA_CLI } from '../shared/orca-bundle'
import type { OrcaExec } from './orca-terminals'

const ORCA_TIMEOUT_MS = 15_000
// Keystrokes follow a screen read and rely on what it showed. The read renews a check with
// under this long left, so no codesign run lands between the two and widens that gap.
const READ_TO_SEND_MS = 1000
const isScreenRead = (args: string[]): boolean => args[0] === 'terminal' && args[1] === 'read'

type RunProgram = (
  program: string,
  args: string[],
  options: { timeout: number }
) => Promise<{ stdout: string; stderr: string }>

interface OrcaCli {
  exec: OrcaExec
  // Brings Orca's window forward; false when it could not, or when the bundle is not trusted.
  raise: () => Promise<boolean>
}

// Nothing in the bundle runs until its seal and signing team have been checked.
export function createOrcaCli(
  run: RunProgram,
  assertTrusted: (minLeftMs?: number) => Promise<void> = assertOrcaTrusted
): OrcaCli {
  return {
    exec: async (args) => {
      await assertTrusted(isScreenRead(args) ? READ_TO_SEND_MS : 0)
      return (await run(ORCA_CLI, args, { timeout: ORCA_TIMEOUT_MS })).stdout
    },
    // By the path that was verified: a name or a bundle id could resolve to another copy.
    raise: async () => {
      try {
        await assertTrusted()
        await run('/usr/bin/open', ['-a', ORCA_APP], { timeout: ORCA_TIMEOUT_MS })
        return true
      } catch {
        return false
      }
    }
  }
}
