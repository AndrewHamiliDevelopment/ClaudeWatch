import { useId } from 'react'
import { listThemes } from '../themes/registry'

interface ThemePickerProps {
  zoneLabel: string
  // The zone's own choice; null while it inherits.
  themeId: string | null
  inheritLabel: string
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
  const options = [
    { id: null, label: inheritLabel },
    ...listThemes().map((theme) => ({ id: theme.id, label: theme.label }))
  ]
  return (
    <fieldset
      className="flex flex-col py-1.5 pl-3 pr-1"
      onKeyDown={(event) => {
        if (event.key === 'Escape') onDismiss()
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
