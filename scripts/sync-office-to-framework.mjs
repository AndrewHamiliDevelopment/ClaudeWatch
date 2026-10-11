// Copies the built standalone Office into a folder of another repository and records what was
// copied in MANIFEST.json. It writes only inside the folder it is given.
//
//   node scripts/sync-office-to-framework.mjs <target folder> [--from <bundle folder>]
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

// The framework repository refuses a commit that adds a file over 500 KB; this leaves headroom.
const LIMIT_BYTES = 480_000
const MANIFEST = 'MANIFEST.json'
const REPOSITORY = resolve(dirname(fileURLToPath(import.meta.url)), '..')
// A path this script may create or remove: plain names only, so never `..` and never absolute.
const PLAIN_PATH = /^[A-Za-z0-9_-][A-Za-z0-9._-]*(\/[A-Za-z0-9_-][A-Za-z0-9._-]*)*$/

function fail(message, code = 1) {
  process.stderr.write(`${message}\n`)
  process.exit(code)
}

function git(...args) {
  return execFileSync('git', args, { cwd: REPOSITORY, encoding: 'utf8' }).trim()
}

// What the bundle is built from: a change anywhere else does not make the bundle differ.
const BUNDLE_INPUTS = [
  'src',
  'package.json',
  'package-lock.json',
  'vite.office-web.config.ts',
  'vite.office-server.config.ts',
  'tailwind.config.ts',
  'postcss.config.js',
  'scripts/sync-office-to-framework.mjs'
]

// The commit the bundle was built from, and whether its inputs had changed since.
function sourceCommit() {
  try {
    const dirty = git(
      '-c',
      'core.fileMode=false',
      'status',
      '--porcelain',
      '--untracked-files=no',
      '--',
      ...BUNDLE_INPUTS
    )
    return { commit: git('rev-parse', 'HEAD'), dirty: dirty !== '' }
  } catch {
    return { commit: null, dirty: true }
  }
}

function bundleFiles(bundle) {
  let entries
  try {
    entries = readdirSync(bundle, { recursive: true, withFileTypes: true })
  } catch {
    entries = []
  }
  const paths = entries
    .filter((entry) => entry.isFile())
    .map((entry) => relative(bundle, join(entry.parentPath, entry.name)).split(sep).join('/'))
    .filter((path) => path !== MANIFEST)
    .sort()
  if (!paths.includes('server.mjs') || !paths.includes('web/office.html')) {
    fail(`No Office bundle in ${bundle}. Run "npm run build:office-web" first.`)
  }
  return paths.map((path) => {
    const content = readFileSync(join(bundle, path))
    return {
      path,
      bytes: content.length,
      sha256: createHash('sha256').update(content).digest('hex')
    }
  })
}

// Files an earlier sync recorded that this bundle no longer has. Anything else in the target
// (a README the framework added) is not this script's to remove.
function staleFiles(target, files) {
  let recorded
  try {
    recorded = JSON.parse(readFileSync(join(target, MANIFEST), 'utf8')).files
  } catch {
    return []
  }
  const current = new Set(files.map((file) => file.path))
  return (Array.isArray(recorded) ? recorded : [])
    .map((file) => file?.path)
    .filter((path) => typeof path === 'string' && PLAIN_PATH.test(path) && !current.has(path))
}

const args = process.argv.slice(2)
const fromFlag = args.indexOf('--from')
const from = fromFlag === -1 ? [] : args.splice(fromFlag, 2).slice(1)
if (args.length !== 1 || args[0].startsWith('--') || (fromFlag !== -1 && !from[0])) {
  fail(
    'Usage: node scripts/sync-office-to-framework.mjs <target folder> [--from <bundle folder>]',
    2
  )
}
const bundle = resolve(from[0] ?? join(REPOSITORY, 'out/office-web'))
const target = resolve(args[0])

const files = bundleFiles(bundle)
const oversized = files.filter((file) => file.bytes > LIMIT_BYTES)
if (oversized.length > 0) {
  fail(
    oversized
      .map((file) => `${file.path} is ${file.bytes} bytes, over the ${LIMIT_BYTES} byte limit`)
      .join('\n')
  )
}
if (files.some((file) => !PLAIN_PATH.test(file.path))) fail('The bundle holds an unexpected path')

// Syncing a bundle onto itself only stamps its manifest: the build does this as its last step.
if (target !== bundle) {
  for (const path of staleFiles(target, files)) rmSync(join(target, path), { force: true })
  for (const { path } of files) {
    mkdirSync(dirname(join(target, path)), { recursive: true })
    copyFileSync(join(bundle, path), join(target, path))
  }
}
writeFileSync(
  join(target, MANIFEST),
  `${JSON.stringify({ name: 'claudewatch-office-web', ...sourceCommit(), limitBytes: LIMIT_BYTES, files }, null, 2)}\n`
)

const width = Math.max(...files.map((file) => file.path.length))
for (const file of files) {
  process.stdout.write(`${file.path.padEnd(width)}  ${String(file.bytes).padStart(7)} bytes\n`)
}
const total = files.reduce((sum, file) => sum + file.bytes, 0)
process.stdout.write(`${files.length} files, ${total} bytes, in ${target}\n`)
