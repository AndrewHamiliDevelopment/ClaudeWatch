import { Pencil } from 'lucide-react'
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { MAX_ALIAS_LENGTH, type AliasResult } from '../../../shared/accounts'
import { cn } from '../../lib/utils'
import {
  BUTTON_PRIMARY_COMPACT_CLASS,
  BUTTON_QUIET_COMPACT_CLASS,
  FIELD_CLASS,
  ICON_BUTTON_CLASS,
  PLATE_TITLE_CLASS
} from '../deck/deck-styles'

const SAVE_FAILED_TEXT = 'The name could not be saved. Try again.'

const REFUSAL_TEXT: Record<NonNullable<AliasResult['reason']>, string> = {
  'invalid-alias': `That name cannot be used. Use plain text, up to ${MAX_ALIAS_LENGTH} characters.`,
  off: 'Accounts are not being watched, so the name was not saved.',
  'unknown-account': 'This account is no longer on the list, so the name was not saved.'
}

interface AccountNameProps {
  name: string
  alias: string | null
  onRename: (alias: string | null) => Promise<AliasResult>
}

// The card's heading, and the inline field that renames it.
export function AccountName({ name, alias, onRename }: AccountNameProps) {
  const [isEditing, setIsEditing] = useState(false)
  const renameButtonRef = useRef<HTMLButtonElement>(null)
  const hasEdited = useRef(false)

  // Closing the field removes the focused element, so focus goes back to what opened it.
  useEffect(() => {
    if (!isEditing && hasEdited.current) renameButtonRef.current?.focus()
    hasEdited.current = isEditing
  }, [isEditing])

  if (isEditing) {
    return <RenameForm alias={alias} onRename={onRename} onClose={() => setIsEditing(false)} />
  }
  return (
    <div className="flex min-w-0 items-center gap-1">
      <h2 className={cn(PLATE_TITLE_CLASS, 'truncate')}>{name}</h2>
      <button
        ref={renameButtonRef}
        type="button"
        aria-label={`Rename ${name}`}
        onClick={() => setIsEditing(true)}
        className={ICON_BUTTON_CLASS}
      >
        <Pencil className="size-3.5" aria-hidden="true" />
      </button>
    </div>
  )
}

interface RenameFormProps extends Pick<AccountNameProps, 'alias' | 'onRename'> {
  onClose: () => void
}

function RenameForm({ alias, onRename, onClose }: RenameFormProps) {
  const [draft, setDraft] = useState(alias ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const hintId = useId()
  const refusalId = useId()

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const save = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    const nextAlias = draft.trim() || null
    if (nextAlias === alias) return onClose()
    setIsSaving(true)
    const result = await onRename(nextAlias)
    setIsSaving(false)
    if (result.success) return onClose()
    setRefusal(result.reason ? REFUSAL_TEXT[result.reason] : SAVE_FAILED_TEXT)
    inputRef.current?.focus()
  }

  const cancelOnEscape = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') onClose()
  }

  return (
    <form onSubmit={(event) => void save(event)} className="flex min-w-0 flex-col gap-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <input
          ref={inputRef}
          type="text"
          name="account-alias"
          autoComplete="off"
          aria-label="Name for this account"
          aria-invalid={refusal !== null}
          aria-describedby={refusal === null ? hintId : `${refusalId} ${hintId}`}
          maxLength={MAX_ALIAS_LENGTH}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={cancelOnEscape}
          className={cn(FIELD_CLASS, 'h-7 min-w-0 flex-1 px-2')}
        />
        <button type="submit" disabled={isSaving} className={BUTTON_PRIMARY_COMPACT_CLASS}>
          {isSaving ? 'Saving…' : 'Save name'}
        </button>
        <button type="button" onClick={onClose} className={BUTTON_QUIET_COMPACT_CLASS}>
          Cancel
        </button>
      </div>
      {refusal !== null && (
        <p id={refusalId} role="alert" className="text-xs font-semibold text-accent-hot">
          {refusal}
        </p>
      )}
      <p id={hintId} className="text-caption text-text-tertiary">
        Leave it empty to go back to the default name.
      </p>
    </form>
  )
}
