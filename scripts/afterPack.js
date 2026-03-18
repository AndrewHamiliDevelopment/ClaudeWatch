/**
 * electron-builder afterPack hook.
 * Re-signs the WidgetKit .appex with its own entitlements after the universal
 * merge but before the final app bundle is signed.
 */
const { execFileSync } = require('child_process')
const path = require('path')
const fs = require('fs')

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return

  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`)
  const appexPath = path.join(appPath, 'Contents/PlugIns/ClaudeWatchWidgetExtension.appex')

  if (!fs.existsSync(appexPath)) {
    console.log('  • afterPack: widget .appex not found, skipping re-sign')
    return
  }

  const entitlements = path.join(__dirname, '..', 'widget', 'ClaudeWatchWidget', 'ClaudeWatchWidget.entitlements')

  if (!fs.existsSync(entitlements)) {
    console.log('  • afterPack: widget entitlements not found, skipping re-sign')
    return
  }

  // Find the signing identity electron-builder is using
  const identity = context.packager.platformSpecificBuildOptions.identity ||
    process.env.CSC_NAME ||
    '-'

  console.log('  • afterPack: re-signing widget .appex with its own entitlements')

  try {
    // Strip any existing (invalid) signature first
    execFileSync('codesign', ['--remove-signature', appexPath], { stdio: 'pipe' })

    // Re-sign with widget-specific entitlements
    execFileSync('codesign', [
      '--sign', identity,
      '--entitlements', entitlements,
      '--force',
      '--deep',
      '--options', 'runtime',
      appexPath
    ], { stdio: 'inherit' })
    console.log('  • afterPack: widget re-signed successfully')
  } catch (_err) {
    // If identity signing fails (e.g., no identity found), try ad-hoc signing
    console.log('  • afterPack: identity signing failed, trying ad-hoc...')
    try {
      execFileSync('codesign', [
        '--sign', '-',
        '--entitlements', entitlements,
        '--force',
        '--deep',
        appexPath
      ], { stdio: 'inherit' })
      console.log('  • afterPack: widget ad-hoc signed')
    } catch (e) {
      console.error('  • afterPack: widget signing failed entirely:', e.message)
    }
  }
}
