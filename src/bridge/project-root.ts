import { dirname, join, resolve } from 'node:path'
import { type BridgeIo, isMissing } from './io'

const COMMONDIR_MAX_BYTES = 1024

async function isDirectory(path: string, io: BridgeIo): Promise<boolean> {
  try {
    return (await io.stat(path)).directory
  } catch {
    return false
  }
}

interface Project {
  root: string
  worktree: string | null
}

const PROJECT_TTL_MS = 60_000
const projects = new WeakMap<BridgeIo, Map<string, { project: Promise<Project>; until: number }>>()

// Every tick asks where each session's folder belongs, and the answer costs a stat per folder
// level: it is kept for a minute. A failed look-up is not kept.
export function resolveProject(cwd: string, io: BridgeIo, now = Date.now()): Promise<Project> {
  let known = projects.get(io)
  if (!known) projects.set(io, (known = new Map()))
  const folders = known
  const cached = folders.get(cwd)
  if (cached && now < cached.until) return cached.project
  // A folder whose sessions left is never asked for again, so it is dropped here.
  for (const [folder, { until }] of folders) if (now >= until) folders.delete(folder)
  const project = findProject(cwd, io)
  folders.set(cwd, { project, until: now + PROJECT_TTL_MS })
  project.catch(() => {
    if (folders.get(cwd)?.project === project) folders.delete(cwd)
  })
  return project
}

async function findProject(cwd: string, io: BridgeIo): Promise<Project> {
  let directory = resolve(cwd)
  while (true) {
    const marker = join(directory, '.git')
    try {
      const info = await io.stat(marker)
      if (info.directory) return { root: directory, worktree: null }
      const gitdir = (await io.readText(marker)).match(/^gitdir:\s*(.+)$/m)?.[1]
      if (gitdir) {
        const target = resolve(directory, gitdir.trim())
        const fallback = dirname(dirname(dirname(target)))
        let root = fallback
        try {
          const pointer = join(target, 'commondir')
          // git writes one short path here; anything else is not git's and is not read into a root.
          if ((await io.stat(pointer)).size <= COMMONDIR_MAX_BYTES) {
            const line = (await io.readText(pointer)).trim()
            if (line && !line.includes('\n')) root = dirname(resolve(target, line))
          }
        } catch (error) {
          if (!isMissing(error)) throw error
        }
        if (!(await isDirectory(root, io))) root = fallback
        return { root, worktree: directory === root ? null : directory }
      }
    } catch (error) {
      if (!isMissing(error)) throw error
    }
    const parent = dirname(directory)
    if (parent === directory) return { root: resolve(cwd), worktree: null }
    directory = parent
  }
}
