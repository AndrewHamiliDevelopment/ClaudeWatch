import type { OrcaExec } from './orca-terminals'

export const ORCA_APP = '/Applications/Orca.app'
// The app bundle's CLI, not whatever `orca` is first on PATH.
export const ORCA_CLI = `${ORCA_APP}/Contents/Resources/bin/orca`
// The Developer ID team that signs Orca, as `codesign -dv /Applications/Orca.app` prints it
// (read from Orca 1.4.224).
export const ORCA_TEAM_ID = '6CX3WHS9HZ'

const CODESIGN = '/usr/bin/codesign'
const ORCA_TIMEOUT_MS = 15_000
// Orca updates itself in place, so a passed check is trusted for this long and no longer.
const TRUST_MS = 10 * 60_000

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

async function assertSignedByOrca(run: RunProgram): Promise<void> {
  // --deep --strict: the CLI is a script that starts code nested in the bundle.
  await run(CODESIGN, ['--verify', '--deep', '--strict', ORCA_APP], { timeout: ORCA_TIMEOUT_MS })
  // codesign describes the signature on stderr, one `Key=value` per line.
  const { stderr } = await run(CODESIGN, ['-dv', ORCA_APP], { timeout: ORCA_TIMEOUT_MS })
  if (!stderr.split('\n').includes(`TeamIdentifier=${ORCA_TEAM_ID}`)) {
    throw new Error('Orca is not signed by its expected team')
  }
}

// Nothing in the bundle runs until its seal and signing team have been checked. A failed check
// is not remembered, so an Orca installed later works without a restart.
export function createOrcaCli(run: RunProgram, now: () => number = Date.now): OrcaCli {
  let trusted: Promise<void> | null = null
  let checkedAtMs = 0
  const assertTrusted = (): Promise<void> => {
    if (!trusted || now() - checkedAtMs > TRUST_MS) {
      checkedAtMs = now()
      trusted = assertSignedByOrca(run).catch((error: unknown) => {
        trusted = null
        throw error
      })
    }
    return trusted
  }
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
