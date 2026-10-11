// Probe before mounting the Canvas so a machine without WebGL2 lands on the List view instead of a blank pane.
export function canCreateWebGL2(): boolean {
  try {
    const context = document.createElement('canvas').getContext('webgl2')
    context?.getExtension('WEBGL_lose_context')?.loseContext()
    return context !== null
  } catch (_error) {
    // Some GPU blocklists throw instead of returning null; both mean "no 3D".
    return false
  }
}
