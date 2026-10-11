import { assertOrcaTrusted, ORCA_APP, ORCA_CLI } from '../shared/orca-bundle'
import type { OrcaExec } from './orca-terminals'

const ORCA_TIMEOUT_MS = 15_000

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
  assertTrusted: () => Promise<void> = assertOrcaTrusted
): OrcaCli {
  return {
    exec: async (args) => {
      await assertTrusted()
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
