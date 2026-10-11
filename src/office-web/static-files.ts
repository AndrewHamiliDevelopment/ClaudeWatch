import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { jsonObject, object } from '../bridge/io'

export interface StaticFile {
  body: Buffer
  contentType: string
}

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8'
}
// A page file: under web/, every segment a plain name. `..`, `.`, empty and encoded segments
// do not match, so a manifest cannot name a file outside the bundle.
const PAGE_FILE = /^web((?:\/[A-Za-z0-9_-][A-Za-z0-9._-]*)+)$/

const invalid = (): Error => new Error('MANIFEST.json is not valid')

function manifestEntries(text: string): { path: string; sha256: string }[] {
  const files = jsonObject(text)?.files
  if (!Array.isArray(files)) throw invalid()
  return files.map((value) => {
    const entry = object(value)
    if (typeof entry?.path !== 'string' || typeof entry.sha256 !== 'string') throw invalid()
    return { path: entry.path, sha256: entry.sha256 }
  })
}

// Reads the page into memory once, at start. Requests are answered from this map alone: a
// request path is a lookup key and never becomes a file path.
export async function loadStaticFiles(
  bundleFolder: string
): Promise<ReadonlyMap<string, StaticFile>> {
  const entries = manifestEntries(await readFile(join(bundleFolder, 'MANIFEST.json'), 'utf8'))
  const files = new Map<string, StaticFile>()
  for (const { path, sha256 } of entries) {
    // The bundle's own files beside web/ (the server itself) are listed but never served.
    if (!path.startsWith('web/')) continue
    const urlPath = PAGE_FILE.exec(path)?.[1]
    const contentType = CONTENT_TYPES[extname(path)]
    if (!urlPath || !contentType) throw invalid()
    const body = await readFile(join(bundleFolder, path))
    if (createHash('sha256').update(body).digest('hex') !== sha256) {
      throw new Error(`${path} does not match MANIFEST.json`)
    }
    files.set(urlPath, { body, contentType })
  }
  return files
}
