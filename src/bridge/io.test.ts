import { afterEach, expect, it } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
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
