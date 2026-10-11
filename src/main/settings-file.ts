import { copyFile, open, readFile, realpath, rename, rm, stat } from 'fs/promises'
import { randomBytes } from 'crypto'
import { isJsonObject } from '../shared/json-object'

export type JsonObjectRead =
  | { status: 'ok'; data: Record<string, unknown> }
  | { status: 'missing' }
  | { status: 'unparseable' }

// An unparseable file must never be treated as `{}`: writing back from that
// would replace the user's hooks and permissions with a near-empty file.
export async function readJsonObject(filePath: string): Promise<JsonObjectRead> {
  let raw: string
  try {
    raw = await readFile(filePath, 'utf-8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { status: 'missing' }
    throw error
  }
  try {
    const parsed: unknown = JSON.parse(raw)
    return isJsonObject(parsed) ? { status: 'ok', data: parsed } : { status: 'unparseable' }
  } catch {
    return { status: 'unparseable' }
  }
}

async function resolveTarget(filePath: string): Promise<{ target: string; mode: number | null }> {
  try {
    const target = await realpath(filePath)
    return { target, mode: (await stat(target)).mode & 0o777 }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { target: filePath, mode: null }
    throw error
  }
}

// Temp file + fsync + rename, so a crash or a concurrent reader never sees a half-written file.
export async function writeJsonAtomic(
  filePath: string,
  data: Record<string, unknown>
): Promise<void> {
  const { target, mode } = await resolveTarget(filePath)
  if (mode !== null) await copyFile(target, `${target}.bak`)

  const tempPath = `${target}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`
  const handle = await open(tempPath, 'wx', mode ?? 0o644)
  try {
    await handle.writeFile(JSON.stringify(data, null, 2) + '\n', 'utf-8')
    await handle.sync()
  } finally {
    await handle.close()
  }
  try {
    await rename(tempPath, target)
  } catch (error) {
    await rm(tempPath, { force: true })
    throw error
  }
}
