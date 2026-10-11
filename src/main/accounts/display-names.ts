// What the Accounts screen prints for the ids the ledger's sources carry. The ledger keeps the
// ids; these names are made when a view is built.

// The rate-limit tiers Claude Code itself tells apart (read from its 2.1.296 build).
const PLAN_NAMES: Readonly<Record<string, string>> = {
  default_claude_max_20x: 'Max 20x',
  default_claude_max_5x: 'Max 5x'
}
const ACRONYMS: Readonly<Record<string, string>> = { ai: 'AI', api: 'API' }
const MAX_NAME_LENGTH = 40

// "fableWeekly", "seven_day_sonnet", "team-premium": the words of an id, lower-cased.
function wordsOf(id: string): string[] {
  return id
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z\d]+/)
    .filter(Boolean)
    .map((word) => word.toLowerCase())
}

// Sentence case, with nothing but letters, digits and spaces, so an id from disk prints as text.
function phrase(words: string[]): string {
  const text = words.map((word) => ACRONYMS[word] ?? word).join(' ')
  return (text.charAt(0).toUpperCase() + text.slice(1)).slice(0, MAX_NAME_LENGTH).trim()
}

const PLAN_PREFIX = new Set(['default', 'claude'])

// A plan id as a name: "Max 20x". One this list does not know is tidied, never dropped.
export function planName(id: string): string {
  if (Object.hasOwn(PLAN_NAMES, id)) return PLAN_NAMES[id]
  const words = wordsOf(id)
  const named = words.slice(words.findIndex((word) => !PLAN_PREFIX.has(word)))
  return phrase(named.length && !PLAN_PREFIX.has(named[0]) ? named : words) || 'Unnamed'
}

// Words that only repeat the window's length, which the screen prints beside the scope.
const WINDOW_WORDS = new Set(['weekly', 'week', 'session', 'daily', 'day', 'hour', 'hourly'])
const WINDOW_COUNTS = new Set(['one', 'five', 'seven', '1', '5', '7'])

// A limit's scope as the model family it covers: "fableWeekly" reads "Fable" beside "7-day".
export function limitScopeName(scope: string): string {
  const words = wordsOf(scope)
  const family = words.filter((word) => !WINDOW_WORDS.has(word) && !WINDOW_COUNTS.has(word))
  return phrase(family.length ? family : words) || 'Unnamed'
}
