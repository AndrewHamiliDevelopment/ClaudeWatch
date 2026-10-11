import type { OrcaExec } from './orca-terminals'

export const ORCA_APP = '/Applications/Orca.app'
// The app bundle's CLI, not whatever `orca` is first on PATH.
export const ORCA_CLI = `${ORCA_APP}/Contents/Resources/bin/orca`
// The Developer ID team that signs Orca, as `codesign -dv /Applications/Orca.app` prints it
// (read from Orca 1.4.224).
export const ORCA_TEAM_ID = '6CX3WHS9HZ'

const ORCA_BUNDLE_ID = 'com.stablyai.orca'
const CODESIGN = '/usr/bin/codesign'
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

async function assertSignedByOrca(run: RunProgram): Promise<void> {
  await run(CODESIGN, ['--verify', ORCA_APP], { timeout: ORCA_TIMEOUT_MS })
  // codesign describes the signature on stderr, one `Key=value` per line.
  const { stderr } = await run(CODESIGN, ['-dv', ORCA_APP], { timeout: ORCA_TIMEOUT_MS })
  if (!stderr.split('\n').includes(`TeamIdentifier=${ORCA_TEAM_ID}`)) {
    throw new Error('Orca is not signed by its expected team')
  }
}

// Nothing in the bundle runs until its seal and signing team have been checked, once per app
// run. A failed check is not remembered, so an Orca installed later works without a restart.
export function createOrcaCli(run: RunProgram): OrcaCli {
  let trusted: Promise<void> | null = null
  const assertTrusted = (): Promise<void> => {
    trusted ??= assertSignedByOrca(run).catch((error: unknown) => {
      trusted = null
      throw error
    })
    return trusted
  }
  return {
    exec: async (args) => {
      await assertTrusted()
      return (await run(ORCA_CLI, args, { timeout: ORCA_TIMEOUT_MS })).stdout
    },
    // By bundle id, so another app that happens to be named "Orca" is never launched.
    raise: async () => {
      try {
        await assertTrusted()
        await run('/usr/bin/open', ['-b', ORCA_BUNDLE_ID], { timeout: ORCA_TIMEOUT_MS })
        return true
      } catch {
        return false
      }
    }
  }
}
