import {
  closeSync,
  fchmodSync,
  fsyncSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeSync
} from 'fs'
import { isMissing } from '../../bridge/io'
import { fromStored, toStored } from './ledger-shape'
import type { LedgerState } from './ledger-state'

const OWNER_ONLY = 0o600

// The ledger holds email addresses, so only its owner may read it. Written whole to a
// temporary file and renamed, synchronously: the last save happens while the app is quitting.
export function saveLedger(path: string, state: LedgerState): void {
  const temporary = `${path}.${process.pid}.tmp`
  try {
    const file = openSync(temporary, 'w', OWNER_ONLY)
    try {
      // A leftover temporary file keeps its old mode when reopened.
      fchmodSync(file, OWNER_ONLY)
      writeSync(file, JSON.stringify(toStored(state)))
      fsyncSync(file)
    } finally {
      closeSync(file)
    }
    renameSync(temporary, path)
  } catch (error) {
    rmSync(temporary, { force: true })
    throw error
  }
}

// null when nothing was saved yet, or when the file is not a ledger this version can read.
export function loadLedger(path: string): LedgerState | null {
  let text: string
  try {
    text = readFileSync(path, 'utf8')
  } catch (error) {
    if (isMissing(error)) return null
    throw error
  }
  let ledger: LedgerState | null = null
  try {
    ledger = fromStored(JSON.parse(text))
  } catch {
    // Not JSON: handled with every other unreadable file below.
  }
  // The next save would replace it, so an unreadable ledger is set aside, never destroyed.
  if (!ledger) renameSync(path, `${path}.damaged`)
  return ledger
}
