import { createRoot } from 'react-dom/client'
import '../styles/globals.css'
import { createLiveFeed } from '../office-live/live-feed'
import { OfficeApp } from './OfficeApp'
import type { OfficeFeed } from './scene-model'
import { createWebBridge, takeLaunchToken } from './web-bridge'

// The Electron window's preload first, then the standalone server that launched this page.
// The fixture is imported lazily so the scripted demo data never ships in the Office window's main chunk.
async function resolveFeed(): Promise<OfficeFeed> {
  const launchToken = window.officeBridge ? null : takeLaunchToken(window)
  const bridge = window.officeBridge ?? (launchToken ? createWebBridge(launchToken) : null)
  if (bridge) return createLiveFeed(bridge, { storage: window.localStorage })
  const { createFixtureFeed } = await import('./fixture/fixture-feed')
  return createFixtureFeed()
}

const root = document.getElementById('root')
if (root) {
  void resolveFeed().then((feed) => createRoot(root).render(<OfficeApp feed={feed} />))
}
