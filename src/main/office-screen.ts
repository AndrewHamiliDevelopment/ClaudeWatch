import type { ProviderId } from '../shared/office/types'

// What Orca calls each provider's agent in a pane.
export const ORCA_AGENTS: Record<ProviderId, readonly string[]> = {
  claude: ['claude', 'claude-agent-teams'],
  codex: ['codex'],
  opencode: ['opencode']
}

const PEEK_LINES = 40
// Claude Code's permission dialog; respond() sends nothing unless it is on screen.
export const PERMISSION_PROMPT =
  /Do you want to (proceed|make this edit|create|allow)|❯\s*1\.\s*Yes/
// Claude Code reports 'waiting' only while a dialog covers its prompt (a permission, a picker,
// an MCP form), never for a turn that merely ended with a question: that one is idle.
// The rule Claude Code draws directly above and below its input line.
const RULE = /^─{8,}/
// Status lines and a task list sit under Claude Code's input line; Codex shows a footer or two.
const CLAUDE_FOOTER_LINES = 24
const CODEX_FOOTER_LINES = 4
// A highlighted row of a picker or dialog, boxed or not.
const POINTER_ROW = /^[\s│|]*[❯›]\s/

// The last PEEK_LINES rendered lines without trailing blanks: what the owner sees in the office.
export function visibleLines(screen: string[]): string[] {
  let end = screen.length
  while (end > 0 && !screen[end - 1].trim()) end--
  return screen.slice(Math.max(0, end - PEEK_LINES), end)
}

// True only when the bottom of the screen is the agent's own input line, in a shape read off
// live panes; a dialog, a picker or any screen not recognised is not one, so nothing is typed.
// Claude Code: `❯` in the first column, alone or before a draft, a rule directly above and below.
// Codex: `›` in the first column before its placeholder or a draft, never a numbered row, with
// only indented footer lines under it, one of them the shortcuts hint.
export function showsInputLine(agent: string | null, screen: string[]): boolean {
  if (ORCA_AGENTS.codex.some((name) => name === agent)) {
    const at = screen.findLastIndex((line) => /^›\s/.test(line))
    const footer = screen.slice(at + 1)
    return (
      at >= 0 &&
      !/^›\s*\d+[.)]/.test(screen[at]) &&
      footer.length <= CODEX_FOOTER_LINES &&
      footer.every((line) => /^\s{2}\S/.test(line)) &&
      footer.some((line) => /^\s+\? for shortcuts/.test(line))
    )
  }
  const at = screen.findLastIndex((line) => /^❯(\s|$)/.test(line))
  const footer = screen.slice(at + 2)
  return (
    at > 0 &&
    RULE.test(screen[at - 1]) &&
    RULE.test(screen[at + 1] ?? '') &&
    footer.length <= CLAUDE_FOOTER_LINES &&
    !footer.some((line) => POINTER_ROW.test(line))
  )
}
