import { afterEach, expect, it } from 'vitest'
import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { systemIo } from './io'

const directories: string[] = []
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))
  )
})
it('reads bounded tails, discards partial first records and returns only header lines', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'bridge-tail-'))
  directories.push(directory)
  const path = join(directory, 'transcript.jsonl')
  const header = '{"type":"session_meta","payload":{"cwd":"/repo"}}'
  const last = '{"type":"event_msg","payload":{"type":"task_complete"}}\n'
  await writeFile(path, `${header}\n${'x'.repeat(70000)}\n${last}`)
  expect(await systemIo.readFirstLine(path)).toBe(header)
  expect(await systemIo.readTail(path)).toBe(last)
})

it('reads complete session metadata beyond 64 KB and bounds oversized headers', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'bridge-header-'))
  directories.push(directory)
  const path = join(directory, 'rollout.jsonl')
  const header = JSON.stringify({
    type: 'session_meta',
    payload: { padding: 'x'.repeat(100000), id: 'a', cwd: '/repo' }
  })
  await writeFile(path, `${header}\nignored`)
  expect(await systemIo.readFirstLine(path)).toBe(header)
  await writeFile(path, 'x'.repeat(262145))
  expect(await systemIo.readFirstLine(path)).toBe('')
})

it('refuses to open credential stores, whatever a caller asks for', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'bridge-guard-'))
  directories.push(directory)
  for (const name of ['.credentials.json', 'auth.json', 'orca-runtime.json', '42.key']) {
    const path = join(directory, name)
    await writeFile(path, 'DO_NOT_READ')
    await expect(systemIo.readText(path)).rejects.toThrow('forbidden')
    await expect(systemIo.readTail(path)).rejects.toThrow('forbidden')
    await expect(systemIo.readFirstLine(path)).rejects.toThrow('forbidden')
  }
})

it('refuses a credential store reached through a symlink or a different letter case', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'bridge-guard-'))
  directories.push(directory)
  await writeFile(join(directory, '.credentials.json'), 'DO_NOT_READ')
  await symlink(join(directory, '.credentials.json'), join(directory, '42.json'))
  for (const name of ['42.json', '.Credentials.JSON']) {
    const path = join(directory, name)
    await expect(systemIo.readText(path)).rejects.toThrow('forbidden')
    await expect(systemIo.readTail(path)).rejects.toThrow('forbidden')
    await expect(systemIo.readFirstLine(path)).rejects.toThrow('forbidden')
  }
})

it('runs only the three programs the bridge needs', async () => {
  await expect(systemIo.exec('/bin/sh', ['-c', 'echo hi'])).rejects.toThrow('forbidden')
  await expect(systemIo.exec('/usr/bin/security', ['find-generic-password'])).rejects.toThrow(
    'forbidden'
  )
  expect(await systemIo.exec('/bin/ps', ['-o', 'pid=', '-p', String(process.pid)])).toContain(
    String(process.pid)
  )
})
