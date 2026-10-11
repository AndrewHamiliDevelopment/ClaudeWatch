import { builtinModules } from 'module'
import { resolve } from 'path'
import { defineConfig, type Plugin } from 'vite'

// Node's own modules stay imports, written `node:x` however the source spelled them, so the
// built file visibly depends on nothing else.
const nodeBuiltins: Plugin = {
  name: 'office-server:node-builtins',
  enforce: 'pre',
  resolveId(source) {
    const name = source.replace(/^node:/, '')
    return builtinModules.includes(name) ? { id: `node:${name}`, external: true } : null
  }
}

// The standalone Office server as one file with no runtime dependency: out/office-web/server.mjs.
// It runs first in build:office-web and empties the folder the page is then built into.
export default defineConfig({
  plugins: [nodeBuiltins],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/main')
    }
  },
  ssr: { noExternal: true },
  build: {
    ssr: resolve(__dirname, 'src/office-web/cli.ts'),
    outDir: resolve(__dirname, 'out/office-web'),
    emptyOutDir: true,
    target: 'node22',
    minify: false,
    rollupOptions: {
      output: { format: 'es', entryFileNames: 'server.mjs', inlineDynamicImports: true }
    }
  }
})
