// Control characters: a terminal acts on them rather than printing them.
export const CONTROL_CHARACTER = /\p{Cc}/u
// Controls, line breaks, and the marks that reorder or hide the text beside them.
export const UNSAFE_IN_A_NAME = /[\p{Cc}\u2028\u2029\u202a-\u202e\u2066-\u2069]/u
