const FNV_OFFSET_BASIS = 0xcbf29ce484222325n
const FNV_PRIME = 0x100000001b3n
const UINT64_MASK = 0xffffffffffffffffn

function fnv1a64(text: string): string {
  let hash = FNV_OFFSET_BASIS
  for (const byte of new TextEncoder().encode(text)) {
    hash ^= BigInt(byte)
    hash = (hash * FNV_PRIME) & UINT64_MASK
  }
  return hash.toString(16).padStart(16, '0')
}

// Floor identity for a project. Callers pass the resolved project root (the bridge
// resolves the git common dir); this stays pure so the renderer can import it.
export function projectKey(projectRoot: string): string {
  const normalised = projectRoot.length > 1 ? projectRoot.replace(/\/+$/, '') : projectRoot
  return `p_${fnv1a64(normalised)}`
}
