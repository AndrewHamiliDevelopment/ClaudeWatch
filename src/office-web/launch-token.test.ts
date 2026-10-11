import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createLaunchToken, isLaunchToken, writeLaunchFile } from './launch-token'

describe('launch token', () => {
  it('is 32 random bytes in URL-safe text, new on every launch', () => {
    const first = createLaunchToken()

    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(createLaunchToken()).not.toBe(first)
  })

  it('accepts only the exact token', () => {
    const token = createLaunchToken()

    expect(isLaunchToken(token, token)).toBe(true)
    for (const presented of [undefined, '', token.slice(1), `${token}x`, createLaunchToken()]) {
      expect(isLaunchToken(token, presented)).toBe(false)
    }
  })
})

describe('writeLaunchFile', () => {
  const token = createLaunchToken()
  let home: string
  let folder: string

  beforeEach(async () => {
    home = await mkdtemp(join(tmpdir(), 'office-launch-'))
    folder = join(home, 'state', 'office')
  })

  afterEach(() => rm(home, { recursive: true, force: true }))

  it('writes a page only its owner can read, in a folder only its owner can list', async () => {
    const path = await writeLaunchFile(folder, 5199, token)

    expect(path).toBe(join(folder, 'launch-5199.html'))
    expect((await stat(path)).mode & 0o777).toBe(0o600)
    expect((await stat(folder)).mode & 0o777).toBe(0o700)
  })

  it('carries the token only in the fragment of the loopback address', async () => {
    const page = await readFile(await writeLaunchFile(folder, 5199, token), 'utf8')
    const address = `http://127.0.0.1:5199/office.html#t=${token}`

    expect(page).toContain(`content="0;url=${address}"`)
    expect(page.split(address).join('')).not.toContain(token)
  })

  it('replaces a launch file left readable by an earlier run', async () => {
    const path = await writeLaunchFile(folder, 5199, token)
    await rm(path)
    await writeFile(path, 'stale', { mode: 0o644 })

    await writeLaunchFile(folder, 5199, token)

    expect((await stat(path)).mode & 0o777).toBe(0o600)
    expect(await readFile(path, 'utf8')).not.toContain('stale')
  })
})
