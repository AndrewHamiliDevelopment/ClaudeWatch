/**
 * electron-builder afterPack hook (named afterSign.js for historical reasons,
 * but configured as afterPack in electron-builder.yml).
 *
 * Two jobs:
 * 1. Thin the universal widget binary to match the current build arch so that
 *    electron-builder's universal merge (lipo) can combine x64 + arm64 slices.
 * 2. Re-sign the widget .appex with its own entitlements and the developer
 *    certificate so the App Group container works at runtime.
 */
const { execFileSync, spawnSync } = require('child_process')
const path = require('path')
const fs = require('fs')

/**
 * Find the developer signing identity from the macOS keychain.
 * Returns the first "Apple Development" or "Developer ID Application" identity found.
 */
function findSigningIdentity() {
  try {
    const result = spawnSync('security', ['find-identity', '-v', '-p', 'codesigning'], {
      encoding: 'utf-8'
    })
    const output = result.stdout || ''
    const lines = output.split('\n')

    // Prefer "Developer ID Application" first (needed for distribution), then "Apple Development"
    for (const preferred of ['Developer ID Application', 'Apple Development']) {
      for (const line of lines) {
        if (line.includes(preferred) && !line.includes('CSSMERR_TP_CERT_REVOKED')) {
          const hashMatch = line.match(/([0-9A-F]{40})/)
          if (hashMatch) {
            return hashMatch[1]
          }
        }
      }
    }

    // Fallback: use first valid identity
    for (const line of lines) {
      const hashMatch = line.match(/^\s+\d+\)\s+([0-9A-F]{40})/)
      if (hashMatch && !line.includes('CSSMERR_TP_CERT_REVOKED')) {
        return hashMatch[1]
      }
    }
  } catch {
    // ignore
  }
  return null
}

/**
 * Thin a universal (fat) binary to a single architecture using lipo.
 * If the binary is already single-arch, this is a no-op.
 */
function thinBinary(binaryPath, arch) {
  try {
    // Check if the binary is a fat binary
    const fileOutput = execFileSync('file', [binaryPath], { encoding: 'utf-8' })
    if (!fileOutput.includes('universal binary')) {
      console.log(`  • afterPack: widget binary is already single-arch, skipping thin`)
      return
    }

    console.log(`  • afterPack: thinning widget binary to ${arch}`)
    execFileSync('lipo', [binaryPath, '-thin', arch, '-output', binaryPath], { stdio: 'pipe' })
  } catch (err) {
    console.warn(`  • afterPack: lipo thin failed (non-fatal): ${err.message}`)
  }
}

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return

  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`)
  const appexPath = path.join(appPath, 'Contents/PlugIns/ClaudeWatchWidgetExtension.appex')

  if (!fs.existsSync(appexPath)) {
    console.log('  • afterPack: widget .appex not found, skipping')
    return
  }

  // Step 1: Thin the widget binary to match the current build architecture.
  // electron-builder builds x64 and arm64 separately, then uses lipo to create
  // a universal binary. If our widget is already universal in both temp builds,
  // lipo fails ("same architectures"). We thin to single-arch so lipo can merge.
  const widgetBinary = path.join(appexPath, 'Contents/MacOS/ClaudeWatchWidgetExtension')
  const arch = context.arch === 1 ? 'x86_64' : 'arm64' // electron-builder: 1=x64, 3=arm64
  thinBinary(widgetBinary, arch)

  // Step 2: Re-sign with widget-specific entitlements
  const entitlements = path.join(
    __dirname,
    '..',
    'widget',
    'ClaudeWatchWidget',
    'ClaudeWatchWidget.entitlements'
  )

  if (!fs.existsSync(entitlements)) {
    console.log('  • afterPack: widget entitlements not found, skipping re-sign')
    return
  }

  const identity =
    context.packager.platformSpecificBuildOptions.identity ||
    process.env.CSC_NAME ||
    findSigningIdentity()

  if (!identity) {
    console.log('  • afterPack: no signing identity found, stripping widget signature')
    try {
      execFileSync('codesign', ['--remove-signature', appexPath], { stdio: 'pipe' })
    } catch {
      // ignore
    }
    return
  }

  console.log(`  • afterPack: re-signing widget .appex with identity: ${identity}`)

  try {
    execFileSync('codesign', ['--remove-signature', appexPath], { stdio: 'pipe' })
    execFileSync(
      'codesign',
      [
        '--sign',
        identity,
        '--entitlements',
        entitlements,
        '--force',
        '--options',
        'runtime',
        appexPath
      ],
      { stdio: 'inherit' }
    )
    console.log('  • afterPack: widget re-signed successfully')
  } catch (err) {
    console.error('  • afterPack: widget signing failed:', err.message)
    try {
      execFileSync('codesign', ['--remove-signature', appexPath], { stdio: 'pipe' })
    } catch {
      // ignore
    }
  }
}
