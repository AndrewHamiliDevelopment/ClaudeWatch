// HUD-only class strings. Plates, buttons and slips come from the Dispatch Deck
// (components/deck); focus rings come from globals.css.
export const KBD_CLASS =
  'rounded border border-border-strong px-1 font-mono text-caption text-text-secondary'

// A keycap on the lantern button, where the plate's grey would not read.
export const KBD_INK_CLASS = 'rounded border border-ink/60 px-1 font-mono text-caption text-ink'

// A row in a plate. The current row is marked by a brass edge as well as its fill.
export const ROW_CLASS =
  'flex min-h-[30px] min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 text-left transition-colors hover:bg-surface-hover disabled:hover:bg-transparent aria-[current=true]:bg-surface-hover aria-[current=true]:ring-1 aria-[current=true]:ring-inset aria-[current=true]:ring-brass'

// A bottom-bar control. Pressed is a brass edge and brighter text, never the fill alone.
export const BAR_BUTTON_CLASS =
  'inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50 aria-pressed:bg-surface-hover aria-pressed:text-text-primary aria-pressed:ring-1 aria-pressed:ring-inset aria-pressed:ring-brass'

// A count in the plate face; the caller picks its colour.
export const COUNT_CLASS = 'font-plate text-count align-[-2px]'

// Text entry on a plate.
export const FIELD_CLASS =
  'resize-none rounded-md border border-border-strong bg-surface px-2 py-1.5 text-body text-text-primary'
