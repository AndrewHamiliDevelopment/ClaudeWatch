import { createRoot } from 'react-dom/client'
import '../styles/globals.css'
import { createLiveFeed } from '../office-live/live-feed'
import { OfficeApp } from './OfficeApp'
import type { OfficeFeed } from './scene-model'

// The fixture is imported lazily so the scripted demo data never ships in the Office window's main chunk.
async function resolveFeed(): Promise<OfficeFeed> {
  if (window.officeBridge) {
    return createLiveFeed(window.officeBridge, { storage: window.localStorage })
  }
  const { createFixtureFeed } = await import('./fixture/fixture-feed')
  return createFixtureFeed()
}

const root = document.getElementById('root')
if (root) {
  void resolveFeed().then((feed) => createRoot(root).render(<OfficeApp feed={feed} />))
}
