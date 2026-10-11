import { execFile } from 'node:child_process'

export const ORCA_APP = '/Applications/Orca.app'
// The app bundle's CLI, not whatever `orca` is first on PATH; Homebrew's is a symlink to it.
export const ORCA_CLI = `${ORCA_APP}/Contents/Resources/bin/orca`
// The Developer ID team that signs Orca (read from Orca 1.4.224).
export const ORCA_TEAM_ID = '6CX3WHS9HZ'

const CODESIGN = '/usr/bin/codesign'
const VERIFY_TIMEOUT_MS = 15_000
// Apple's root, a Developer ID intermediate and leaf, and Orca's team on that leaf. An ad-hoc
// signature has no certificate, so nothing a bundle says about itself can satisfy this.
const SIGNED_BY_ORCA = `anchor apple generic and certificate leaf[subject.OU] = "${ORCA_TEAM_ID}" and certificate 1[field.1.2.840.113635.100.6.2.6] exists and certificate leaf[field.1.2.840.113635.100.6.1.13] exists`
// --deep --strict: the CLI is a script that starts code nested in the bundle.
export const verifyArgs = (bundle: string): string[] => [
  '--verify',
  '--deep',
  '--strict',
  `-R=${SIGNED_BY_ORCA}`,
  bundle
]
// One verify (about 0.5 s) covers a burst of calls. The bundle is checked by path and then run
// by path, so a swap inside this window, or between the check and the run, is not caught:
// accepted, since closing it would need the checked file itself to be the one executed.
export const ORCA_TRUST_MS = 3_000

function verifySignature(): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(
      CODESIGN,
      verifyArgs(ORCA_APP),
      { timeout: VERIFY_TIMEOUT_MS, env: { LC_ALL: 'C' } },
      (error) => (error ? reject(error) : resolve())
    )
  })
}

// Resolves when Orca's bundle is sealed and signed by Orca's team; rejects otherwise. A failed
// check is not remembered, so an Orca installed later works without a restart.
// `minLeftMs` is how much of the window a caller needs left: with less, it is checked afresh.
export function createOrcaTrust(
  now: () => number = Date.now
): (minLeftMs?: number) => Promise<void> {
  let trusted: Promise<void> | null = null
  let checkedAtMs = 0
  return (minLeftMs = 0) => {
    if (!trusted || now() - checkedAtMs > ORCA_TRUST_MS - minLeftMs) {
      checkedAtMs = now()
      const check = verifySignature()
      trusted = check
      check.catch(() => {
        if (trusted === check) trusted = null
      })
    }
    return trusted
  }
}

// One per process: everything in it that runs the Orca CLI shares a single check per burst.
export const assertOrcaTrusted = createOrcaTrust()
