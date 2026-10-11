// Shared HUD class strings. Text stays on text-primary/secondary: tertiary (#636366) and
// accent-as-text fail 4.5:1 on the surface colours (research §13).
export const PANEL_CLASS = 'rounded-card border border-border bg-surface-raised/95 shadow-lg'

export const FOCUS_RING_CLASS =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

export const HUD_BUTTON_CLASS =
  'rounded-md px-2.5 py-1.5 text-body text-text-primary transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50'

export const KBD_CLASS =
  'rounded border border-border-strong px-1 font-mono text-caption text-text-secondary'
