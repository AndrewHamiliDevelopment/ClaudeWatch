// `window.localStorage` throws where site data is blocked; callers then run without remembering.
export function browserStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

// Reading can be refused even where the storage object itself is handed out.
export function readStored(key: string): string | null {
  try {
    return browserStorage()?.getItem(key) ?? null
  } catch {
    return null
  }
}

export function writeStored(key: string, value: string): void {
  try {
    browserStorage()?.setItem(key, value)
  } catch {
    // Not remembered; the page keeps working.
  }
}
