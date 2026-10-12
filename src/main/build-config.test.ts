import { createHash } from 'node:crypto'
import reactPlugin from '@vitejs/plugin-react'
import { describe, it, expect } from 'vitest'
import { readFile } from 'fs/promises'
import { resolve } from 'path'

describe('electron-builder mac entitlements', () => {
  it('should sign the main macOS app with the shared entitlements file', async () => {
    const configPath = resolve(process.cwd(), 'electron-builder.yml')
    const config = await readFile(configPath, 'utf-8')

    expect(config).toMatch(
      /\nmac:\n(?:[ \t].*\n)*[ \t]+entitlements:\s+build\/entitlements\.mac\.plist\b/
    )
    expect(config).toMatch(
      /\nmac:\n(?:[ \t].*\n)*[ \t]+entitlementsInherit:\s+build\/entitlements\.mac\.plist\b/
    )
  })
})

import { getConfig } from 'app-builder-lib/out/util/config/load'
import { validateConfiguration } from 'app-builder-lib/out/util/config/config'
import type { Configuration } from 'app-builder-lib'
import { DebugLogger } from 'builder-util'

describe('electron-builder files', () => {
  it('leaves the standalone web bundle out of the app package', async () => {
    const config = await readFile(resolve(process.cwd(), 'electron-builder.yml'), 'utf-8')
    expect(config).toMatch(/\nfiles:\n(?:[ \t]+- .*\n)*[ \t]+- '!out\/office-web\/\*\*\/\*'\n/)
  })
})

describe('platform hardening integration', () => {
  it.each(['src/main/index.ts', 'src/main/tray.ts'])('uses the factory in %s', async (path) => {
    const source = await readFile(resolve(process.cwd(), path), 'utf-8')
    expect(source).toContain('createAppWindow({')
    expect(source).not.toContain('new BrowserWindow(')
    expect(source).not.toContain('sandbox: false')
  })

  it('keeps CSP eval-free with local websocket HMR', async () => {
    const html = await readFile(resolve(process.cwd(), 'src/renderer/index.html'), 'utf-8')
    expect(html).not.toContain("'unsafe-eval'")
    expect(html).toContain("style-src 'self' 'unsafe-inline'")
    expect(html).toContain("connect-src 'self' ws://localhost:* ws://127.0.0.1:*")
  })

  it('keeps preload runtime imports limited to Electron', async () => {
    const source = await readFile(resolve(process.cwd(), 'src/preload/index.ts'), 'utf-8')
    const runtimeImports = [
      ...source.matchAll(/import\s+(?!type\b)[\s\S]*?from\s+['"]([^'"]+)['"]/g)
    ]
    expect(runtimeImports.map((match) => match[1])).toEqual(['electron'])
    expect(source).toContain('export type ElectronAPI = typeof api')
  })

  it('validates the full builder config against the installed v26 schema', async () => {
    const loaded = await getConfig<Configuration>(
      {
        packageKey: 'build',
        configFilename: 'electron-builder',
        projectDir: process.cwd(),
        packageMetadata: null
      },
      resolve(process.cwd(), 'electron-builder.yml')
    )
    expect(loaded).not.toBeNull()
    await expect(
      validateConfiguration(loaded!.result, new DebugLogger(false))
    ).resolves.toBeUndefined()
  })
})

it('allows the exact React refresh preamble without allowing arbitrary inline scripts', async () => {
  const preamble = reactPlugin.preambleCode.replace('__BASE__', '/')
  const hash = createHash('sha256').update(preamble).digest('base64')
  const html = await readFile(resolve(process.cwd(), 'src/renderer/index.html'), 'utf-8')
  expect(html).toContain(`'sha256-${hash}'`)
  expect(html).not.toMatch(/script-src[^;]*'unsafe-inline'/)
})
