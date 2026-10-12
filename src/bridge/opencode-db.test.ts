import { afterEach, expect, it } from 'vitest'
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { systemIo } from './io'
import { OPENCODE_STATEMENTS, type OpencodeDbError, type OpencodeStatement } from './opencode-db'
import { buildOpencodeDb, insertSession, OPENCODE_SCHEMA } from './__fixtures__/opencode-db'

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})
function fixture(fill: Parameters<typeof buildOpencodeDb>[0] = () => {}, schema = OPENCODE_SCHEMA) {
  const built = buildOpencodeDb(fill, schema)
  roots.push(built.root)
  return built
}
const statements = Object.entries(OPENCODE_STATEMENTS)
const failure = (reason: OpencodeDbError['reason']) =>
  expect.objectContaining({ name: 'OpencodeDbError', reason })
const readRoots = (target: string) =>
  systemIo.readOpencode(target, (query) => query('rootSessions', '/repo'))

it.each(statements)('keeps the %s statement to the session tables, bounded and keyed', (_, sql) => {
  const tables = [...sql.matchAll(/\b(?:FROM|JOIN)\s+(\w+)/gi)].map((match) => match[1])
  expect(tables.length).toBeGreaterThan(0)
  for (const table of tables) expect(['session', 'message', 'part']).toContain(table)
  expect(sql).not.toMatch(/credential|account|auth|\*/i)
  expect(sql).toMatch(/^\s*SELECT\b/i)
  expect(sql).toMatch(/\bLIMIT \d+\s*$/)
  expect(sql).toMatch(/\b(session_id|parent_id|directory) = \?/)
  expect(sql).toMatch(/\bINDEXED BY \w+/)
})

it.each(statements)('answers the %s statement from an index, never a table scan', (_, sql) => {
  const { path } = fixture()
  const db = new DatabaseSync(path, { readOnly: true })
  try {
    const values = [...sql.matchAll(/\?/g)].map(() => 'x')
    const plan = db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...values)
    const steps = plan.map((step) => String(step.detail))
    expect(steps.some((step) => step.startsWith('SEARCH'))).toBe(true)
    expect(steps.filter((step) => step.startsWith('SCAN'))).toEqual([])
  } finally {
    db.close()
  }
})

it('runs a fixed statement by name and no other text', async () => {
  const { path } = fixture((db) =>
    insertSession(db, { id: 'ses_a', directory: '/repo', updatedAtMs: 5000 })
  )
  const rows = await readRoots(path)
  expect(rows).toHaveLength(1)
  expect(rows[0]).toMatchObject({ id: 'ses_a', time_updated: 5000 })
  for (const text of ['SELECT value FROM credential LIMIT 1', 'credential', '__proto__']) {
    // Only a caller that lies about the type can even ask.
    const name = text as OpencodeStatement
    await expect(systemIo.readOpencode(path, (query) => query(name))).rejects.toThrow('forbidden')
  }
})

it('opens nothing but a file named opencode.db, and never an auth file', async () => {
  const { root, path } = fixture()
  for (const name of ['auth.json', 'mcp-auth.json', 'MCP-Auth.JSON', 'AUTH.json']) {
    copyFileSync(path, join(root, name))
    await expect(readRoots(join(root, name))).rejects.toThrow('forbidden')
  }
  // A link named like the database is followed, and what it points at is refused.
  mkdirSync(join(root, 'linked'))
  await symlink(join(root, 'mcp-auth.json'), join(root, 'linked', 'opencode.db'))
  await expect(readRoots(join(root, 'linked', 'opencode.db'))).rejects.toThrow('forbidden')
  copyFileSync(path, join(root, 'other.db'))
  await expect(readRoots(join(root, 'other.db'))).rejects.toThrow('forbidden')
})

it('refuses the OpenCode auth files to every file reader, in any letter case and through a link', async () => {
  const { root } = fixture()
  await writeFile(join(root, 'auth.json'), 'DO_NOT_READ')
  await writeFile(join(root, 'mcp-auth.json'), 'DO_NOT_READ')
  await symlink(join(root, 'auth.json'), join(root, 'session.json'))
  await symlink(join(root, 'mcp-auth.json'), join(root, 'mcp.json'))
  for (const name of [
    'auth.json',
    'mcp-auth.json',
    'AUTH.JSON',
    'Mcp-Auth.Json',
    'session.json',
    'mcp.json'
  ]) {
    const path = join(root, name)
    await expect(systemIo.readText(path)).rejects.toThrow('forbidden')
    await expect(systemIo.readTail(path)).rejects.toThrow('forbidden')
    await expect(systemIo.readFirstLine(path)).rejects.toThrow('forbidden')
    await expect(systemIo.readFrom(path, 0, 64)).rejects.toThrow('forbidden')
  }
})

it('reads a database with an unfinished log and leaves every byte of it alone', async () => {
  const { root, path } = fixture()
  const writer = new DatabaseSync(path)
  writer.exec('PRAGMA journal_mode = WAL; PRAGMA wal_autocheckpoint = 0')
  insertSession(writer, { id: 'ses_wal', directory: '/repo', updatedAtMs: 7000 })
  // A copy taken while the writer is open is what a killed OpenCode leaves: a log not yet merged.
  const crashed = join(root, 'crashed')
  mkdirSync(crashed)
  copyFileSync(path, join(crashed, 'opencode.db'))
  copyFileSync(`${path}-wal`, join(crashed, 'opencode.db-wal'))
  writer.close()
  const database = join(crashed, 'opencode.db')
  const before = { db: readFileSync(database), wal: readFileSync(`${database}-wal`) }
  expect(before.wal.length).toBeGreaterThan(0)

  const rows = await readRoots(database)

  expect(rows.map((row) => row.id)).toEqual(['ses_wal'])
  expect(readFileSync(database).equals(before.db)).toBe(true)
  expect(readFileSync(`${database}-wal`).equals(before.wal)).toBe(true)
})

it('says a missing database is missing, and creates none', async () => {
  const { root } = fixture()
  const absent = join(root, 'absent', 'opencode.db')
  await expect(readRoots(absent)).rejects.toEqual(failure('missing'))
  expect(existsSync(absent)).toBe(false)
})

it('says a file that is not a database is unreadable', async () => {
  const { root } = fixture()
  mkdirSync(join(root, 'text'))
  await writeFile(join(root, 'text', 'opencode.db'), 'not a database, '.repeat(300))
  await expect(readRoots(join(root, 'text', 'opencode.db'))).rejects.toEqual(failure('unreadable'))
})

it.each([
  ['column', 'time_archived', 'time_shelved'],
  ['index', 'session_parent_idx', 'other_idx']
])('says a database whose %s was renamed has changed', async (_, from, to) => {
  const { path } = fixture(() => {}, OPENCODE_SCHEMA.replace(from, to))
  await expect(readRoots(path)).rejects.toEqual(failure('changed'))
})

it('says a database another process holds locked is busy', async () => {
  const { path } = fixture()
  const lock = new DatabaseSync(path)
  try {
    lock.exec('BEGIN EXCLUSIVE')
    await expect(readRoots(path)).rejects.toEqual(failure('busy'))
  } finally {
    lock.close()
  }
})

it('reports text that is not JSON as malformed data, not as a row', async () => {
  const { path } = fixture((db) =>
    db.prepare('INSERT INTO message VALUES (?, ?, ?, ?, ?)').run('msg_a', 'ses_a', 1, 1, '{broken')
  )
  await expect(
    systemIo.readOpencode(path, (query) => query('newestMessage', 'ses_a'))
  ).rejects.toEqual(failure('malformed'))
})
