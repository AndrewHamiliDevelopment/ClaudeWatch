// Shared class strings for the Dispatch Deck. Focus rings come from globals.css.
// Sizes are separate constants, never overrides: two height utilities on one element are
// resolved by stylesheet order, not by which one is written last.
const BUTTON_BASE =
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50'
const BUTTON_REGULAR = `${BUTTON_BASE} h-8 px-3 text-body`
const BUTTON_COMPACT = `${BUTTON_BASE} h-7 px-2.5 text-xs`

const PRIMARY_SKIN = 'bg-accent text-ink hover:bg-accent-bright'
const QUIET_SKIN =
  'bg-surface-hover text-text-primary ring-1 ring-inset ring-border hover:ring-border-hover'

export const BUTTON_PRIMARY_CLASS = `${BUTTON_REGULAR} ${PRIMARY_SKIN}`
export const BUTTON_PRIMARY_COMPACT_CLASS = `${BUTTON_COMPACT} ${PRIMARY_SKIN}`
export const BUTTON_QUIET_CLASS = `${BUTTON_REGULAR} ${QUIET_SKIN}`
export const BUTTON_QUIET_COMPACT_CLASS = `${BUTTON_COMPACT} ${QUIET_SKIN}`

// The one button that sits on paper.
export const BUTTON_INK_CLASS = `${BUTTON_COMPACT} bg-ink text-paper hover:bg-ink/85`
// Its second choice (Deny beside Approve): an ink outline, so the first still leads.
export const BUTTON_INK_QUIET_CLASS = `${BUTTON_COMPACT} text-ink ring-1 ring-inset ring-ink hover:bg-ink/10`

const ICON_BUTTON_BASE =
  'inline-grid shrink-0 place-items-center rounded-md text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary'
export const ICON_BUTTON_CLASS = `${ICON_BUTTON_BASE} size-7`
export const ICON_BUTTON_REGULAR_CLASS = `${ICON_BUTTON_BASE} size-8`

// DIN sits high in its box; the top padding centres it against the reading face.
export const PLATE_TITLE_CLASS = 'pt-[3px] font-plate text-title text-text-primary'

export const SEGMENT_CLASS =
  'rounded-md px-2.5 py-1 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary aria-checked:bg-accent-subtle aria-checked:text-accent'

export const FIELD_CLASS =
  'rounded-md border border-border-strong bg-surface text-xs text-text-primary placeholder:text-text-tertiary'
