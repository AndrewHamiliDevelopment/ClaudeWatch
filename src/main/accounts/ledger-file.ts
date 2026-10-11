import {
  closeSync,
  constants,
  fstatSync,
  fsyncSync,
  openSync,
  readSync,
  renameSync,
  rmSync,
  writeSync
} from 'fs'
import { isMissing } from '../../bridge/io'
import { fromStored, toStored } from './ledger-shape'
import type { LedgerState } from './ledger-state'

const OWNER_ONLY = 0o600
// Far above any real ledger. Read synchronously in the main process, so a larger file is not read.
const MAX_LEDGER_BYTES = 16 * 1024 * 1024

// The ledger holds email addresses, so only its owner may read it. Written whole to a
// temporary file and renamed, synchronously: the last save happens while the app is quitting.
export function saveLedger(path: string, state: LedgerState): void {
  const temporary = `${path}.${process.pid}.tmp`
  try {
    // A leftover is removed and the file created anew: an exclusive create never follows a link.
    rmSync(temporary, { force: true })
    const file = openSync(temporary, 'wx', OWNER_ONLY)
    try {
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

// The text of a regular file under the cap, null for anything else at the path. Opened without
// blocking and checked on the open file, so a pipe or a huge file is never read.
function readLedgerText(path: string): string | null {
  const file = openSync(path, constants.O_RDONLY | constants.O_NONBLOCK)
  try {
    const info = fstatSync(file)
    if (!info.isFile() || info.size > MAX_LEDGER_BYTES) return null
    const buffer = Buffer.alloc(info.size)
    return buffer.subarray(0, readSync(file, buffer, 0, info.size, 0)).toString('utf8')
  } finally {
    closeSync(file)
  }
}

// null when nothing was saved yet, or when the file is not a ledger this version can read.
export function loadLedger(path: string): LedgerState | null {
  let text: string | null
  try {
    text = readLedgerText(path)
  } catch (error) {
    if (isMissing(error)) return null
    throw error
  }
  let ledger: LedgerState | null = null
  try {
    if (text !== null) ledger = fromStored(JSON.parse(text))
  } catch {
    // Not JSON: handled with every other unreadable file below.
  }
  // The next save would replace it, so an unreadable ledger is set aside, never destroyed.
  if (!ledger) renameSync(path, `${path}.damaged`)
  return ledger
}
