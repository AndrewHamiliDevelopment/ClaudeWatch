import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { chmod, mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export const createLaunchToken = (): string => randomBytes(32).toString('base64url')

const digest = (text: string): Buffer => createHash('sha256').update(text).digest()

// Compared by digest in constant time, so neither the token nor its length leaks through timing.
export function isLaunchToken(expected: string, presented: string | undefined): boolean {
  return presented !== undefined && timingSafeEqual(digest(expected), digest(presented))
}

// The page the launcher opens. The token rides in the URL fragment, which browsers never send
// to a server and which never shows in `ps` or shell history the way an argument would.
export async function writeLaunchFile(
  folder: string,
  port: number,
  token: string
): Promise<string> {
  const address = `http://127.0.0.1:${port}/office.html#t=${token}`
  const path = join(folder, `launch-${port}.html`)
  await mkdir(folder, { recursive: true, mode: 0o700 })
  await chmod(folder, 0o700)
  // Removed first: writing over an existing file would keep that file's permissions.
  await rm(path, { force: true })
  await writeFile(
    path,
    `<!doctype html>
<meta charset="utf-8" />
<meta http-equiv="refresh" content="0;url=${address}" />
<title>ClaudeWatch Office</title>
`,
    { mode: 0o600, flag: 'wx' }
  )
  return path
}
