// The whole environment of a program whose output is parsed: the C locale and UTC, and none of
// this process's own variables, so nothing token-bearing is passed on.
export const PARSED_OUTPUT_ENV = { LC_ALL: 'C', TZ: 'UTC' }

// `ps` arguments that print when one process started.
export const startTimeArgs = (pid: number): string[] => ['-o', 'lstart=', '-p', String(pid)]
