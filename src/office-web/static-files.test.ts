import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadStaticFiles } from './static-files'

const sha256 = (text: string): string => createHash('sha256').update(text).digest('hex')

describe('loadStaticFiles', () => {
  let outside: string
  let bundle: string

  async function put(path: string, text: string): Promise<{ path: string; sha256: string }> {
    await mkdir(dirname(join(bundle, path)), { recursive: true })
    await writeFile(join(bundle, path), text)
    return { path, sha256: sha256(text) }
  }
  const putManifest = (files: { path: string; sha256: string }[]): Promise<unknown> =>
    put('MANIFEST.json', JSON.stringify({ files }))

  beforeEach(async () => {
    outside = await mkdtemp(join(tmpdir(), 'office-static-'))
    bundle = join(outside, 'bundle')
  })

  afterEach(() => rm(outside, { recursive: true, force: true }))

  it('serves the page files the manifest lists, by their URL path', async () => {
    await putManifest([
      await put('web/office.html', '<!doctype html>'),
      await put('web/assets/office.js', 'export {}'),
      await put('web/assets/office.css', 'body{}'),
      await put('server.mjs', 'server code')
    ])

    const files = await loadStaticFiles(bundle)

    expect([...files.keys()].sort()).toEqual([
      '/assets/office.css',
      '/assets/office.js',
      '/office.html'
    ])
    expect(files.get('/office.html')).toEqual({
      body: Buffer.from('<!doctype html>'),
      contentType: 'text/html; charset=utf-8'
    })
    expect(files.get('/assets/office.js')?.contentType).toBe('text/javascript; charset=utf-8')
    expect(files.get('/assets/office.css')?.contentType).toBe('text/css; charset=utf-8')
  })

  it('serves nothing the manifest does not list, even when it sits in the folder', async () => {
    await put('web/notes.html', 'left behind')
    await putManifest([await put('web/office.html', '<!doctype html>')])

    expect((await loadStaticFiles(bundle)).has('/notes.html')).toBe(false)
  })

  it('never opens a listed file that is not a page file', async () => {
    await putManifest([
      await put('web/office.html', '<!doctype html>'),
      { path: '/etc/hosts', sha256: sha256('not read, so never compared') }
    ])

    expect([...(await loadStaticFiles(bundle)).keys()]).toEqual(['/office.html'])
  })

  it('refuses to start when a file no longer matches its recorded hash', async () => {
    const listed = await put('web/assets/office.js', 'export {}')
    await put('web/assets/office.js', 'export {};fetch("https://evil.test")')
    await putManifest([listed])

    await expect(loadStaticFiles(bundle)).rejects.toThrow(
      'web/assets/office.js does not match MANIFEST.json'
    )
  })

  it.each([
    'web/../../secret.js',
    'web/assets/../../../secret.js',
    'web//secret.js',
    'web/./secret.js',
    'web/assets/%2e%2e/secret.js'
  ])('refuses a manifest that points at %s', async (path) => {
    await writeFile(join(outside, 'secret.js'), 'secret')
    await mkdir(bundle, { recursive: true })
    await putManifest([{ path, sha256: sha256('secret') }])

    await expect(loadStaticFiles(bundle)).rejects.toThrow('MANIFEST.json is not valid')
  })

  it('refuses a page file of a type it does not know how to label', async () => {
    await putManifest([await put('web/payload.exe', 'MZ')])

    await expect(loadStaticFiles(bundle)).rejects.toThrow('MANIFEST.json is not valid')
  })

  it.each([
    ['is missing', null],
    ['is not JSON', '{'],
    ['lists no files', '{}'],
    ['lists a file without a hash', '{"files":[{"path":"web/office.html"}]}']
  ])('refuses to start when the manifest %s', async (_name, manifest) => {
    await put('web/office.html', '<!doctype html>')
    if (manifest !== null) await put('MANIFEST.json', manifest)

    await expect(loadStaticFiles(bundle)).rejects.toThrow()
  })
})
