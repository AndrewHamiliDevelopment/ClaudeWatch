import { useEffect, useRef, useState, type Dispatch } from 'react'
import { newAttentionItems, type AttentionItem } from './logic/attention-queue'
import { commandForKey, keyInputFrom, type OfficeCommand } from './logic/hotkeys'
import type { OfficeAction } from './logic/office-reducer'
import { GEM_SPECS } from './logic/status-gem'
import type { OfficeFeed } from './scene-model'

export function useFeedSubscription(feed: OfficeFeed, dispatch: Dispatch<OfficeAction>): void {
  useEffect(
    () => feed.subscribe((frame) => dispatch({ type: 'frame-received', frame })),
    [feed, dispatch]
  )
}

function actionForCommand(command: OfficeCommand): OfficeAction {
  switch (command.type) {
    case 'walls':
      return { type: 'walls-set', mode: command.mode }
    case 'next-attention':
      return { type: 'next-attention' }
    case 'toggle-list':
      return { type: 'list-toggled' }
    case 'floor-step':
      return { type: 'floor-stepped', delta: command.delta }
    case 'floor-number':
      return { type: 'floor-numbered', number: command.number }
    case 'rotate':
      return { type: 'camera-rotated', direction: command.direction }
    case 'zoom':
      return { type: 'camera-zoomed', direction: command.direction }
    case 'fly-to-selected':
      return { type: 'fly-to-selected' }
    default: {
      const unreachable: never = command
      return unreachable
    }
  }
}

export function useOfficeHotkeys(dispatch: Dispatch<OfficeAction>, isListForced: boolean): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const command = commandForKey(keyInputFrom(event))
      if (!command || (isListForced && command.type === 'toggle-list')) return
      event.preventDefault()
      dispatch(actionForCommand(command))
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [dispatch, isListForced])
}

// One polite, atomic message per change so screen readers hear "Needs permission: PropApp › auth", not a bare count.
export function useAttentionAnnouncement(queue: readonly AttentionItem[]): string {
  const previousRef = useRef<readonly AttentionItem[]>([])
  const [message, setMessage] = useState('')
  useEffect(() => {
    const added = newAttentionItems(previousRef.current, queue)
    previousRef.current = queue
    if (added.length === 0) return
    setMessage(
      added
        .map(
          (item) => `${GEM_SPECS[item.attention].label}: ${item.projectLabel} › ${item.sessionName}`
        )
        .join('. ')
    )
  }, [queue])
  return message
}
