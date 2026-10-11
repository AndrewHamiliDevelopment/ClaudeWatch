// `window.localStorage` throws where site data is blocked; callers then run without remembering.
export function browserStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}
