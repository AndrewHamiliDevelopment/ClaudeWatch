import type { TerminalType } from '../lib/types'

// Absent when a component renders outside the app's windows (a plain browser preview).
export function deckApi(): Window['api'] | undefined {
  return typeof window === 'undefined' ? undefined : window.api
}

export interface JumpTarget {
  pid: number | null
  projectPath: string
  terminalType?: TerminalType
}

// Main decides where a pid lands (the agent's own Orca pane when it can prove it); the
// terminal at the project folder is the fallback for every other host.
export async function jumpToAgent(target: JumpTarget): Promise<void> {
  const api = deckApi()
  if (!api) return
  if (target.pid !== null) {
    try {
      const focus = await api.focusSession(target.pid)
      if (focus?.success) return
    } catch {
      // A focus call that fails outright still leaves the terminal fallback below.
    }
  }
  await api.openTerminal(target.projectPath, target.terminalType)
}

export function openOffice(): void {
  void deckApi()?.openOffice()
}
