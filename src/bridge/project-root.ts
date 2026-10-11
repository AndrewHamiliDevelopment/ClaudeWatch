import { dirname, join, resolve } from 'node:path'
import { type BridgeIo, isMissing } from './io'

export async function resolveProject(
  cwd: string,
  io: BridgeIo
): Promise<{ root: string; worktree: string | null }> {
  let directory = resolve(cwd)
  while (true) {
    const marker = join(directory, '.git')
    try {
      const info = await io.stat(marker)
      if (info.directory) return { root: directory, worktree: null }
      const gitdir = (await io.readText(marker)).match(/^gitdir:\s*(.+)$/m)?.[1]
      if (gitdir) {
        const target = resolve(directory, gitdir.trim())
        let common = dirname(dirname(target))
        try {
          common = resolve(target, (await io.readText(join(target, 'commondir'))).trim())
        } catch (error) {
          if (!isMissing(error)) throw error
        }
        const root = dirname(common)
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
