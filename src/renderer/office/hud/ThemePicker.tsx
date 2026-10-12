import { useId } from 'react'
import type { ThemeRow, ThemeTarget } from '../logic/office-themes'
import { getTheme, listThemes } from '../themes/registry'

interface ThemePickerProps {
  zoneLabel: string
  // The zone's own choice; null while it inherits, or while nothing is chosen yet.
  themeId: string | null
  // Absent for the floor, which has nothing to follow.
  inheritLabel?: string
  onChoose: (themeId: string | null) => void
  onDismiss: () => void
}

const OPTION_CLASS =
  'flex min-h-[28px] items-center gap-2 rounded-md px-1.5 text-xs text-text-primary hover:bg-surface-hover'

// Native radios: arrow keys move the choice and the group needs no roving-focus code.
export function ThemePicker({
  zoneLabel,
  themeId,
  inheritLabel,
  onChoose,
  onDismiss
}: ThemePickerProps) {
  const groupName = useId()
  const options: { id: string | null; label: string }[] = listThemes().map((theme) => ({
    id: theme.id,
    label: theme.label
  }))
  if (inheritLabel) options.unshift({ id: null, label: inheritLabel })
  return (
    <fieldset
      className="flex flex-col py-1.5 pl-3 pr-1"
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return
        // The themes list closes on Escape too; this closes only the choice.
        event.stopPropagation()
        onDismiss()
      }}
    >
      <legend className="pb-1 text-caption text-text-secondary">Theme for {zoneLabel}</legend>
      {options.map((option) => (
        <label key={option.id ?? 'inherit'} className={OPTION_CLASS}>
          <input
            type="radio"
            name={groupName}
            checked={option.id === themeId}
            onChange={() => onChoose(option.id)}
            className="accent-accent"
          />
          {option.label}
        </label>
      ))}
    </fieldset>
  )
}

interface OfficeThemePickerProps {
  row: ThemeRow
  onChoose: (target: ThemeTarget, themeId: string | null) => void
  onDismiss: () => void
}

// The one choice a company or project gets, from its Offices row and from the themes list.
export function OfficeThemePicker({ row, onChoose, onDismiss }: OfficeThemePickerProps) {
  return (
    <ThemePicker
      zoneLabel={row.target.label}
      themeId={row.ownThemeId}
      inheritLabel={`Follow ${row.followsLabel} (${getTheme(row.inheritedThemeId).label})`}
      onChoose={(themeId) => onChoose(row.target, themeId)}
      onDismiss={onDismiss}
    />
  )
}
