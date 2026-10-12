import { describe, expect, it } from 'vitest'
import { parseArgs } from './args'

describe('parseArgs', () => {
  it('defaults to view-only on a port the system picks', () => {
    expect(parseArgs([])).toEqual({ port: 0, interactive: false })
  })

  it('turns on typing into terminals only for the exact switch', () => {
    expect(parseArgs(['--interactive'])).toEqual({ port: 0, interactive: true })
    for (const near of ['--interactiv', '-i', '--interactive=true', 'interactive']) {
      expect(parseArgs([near])).toBeNull()
    }
  })

  it('takes a port', () => {
    expect(parseArgs(['--port', '5199', '--interactive'])).toEqual({
      port: 5199,
      interactive: true
    })
  })

  it.each([
    ['--port'],
    ['--port', 'abc'],
    ['--port', '70000'],
    ['--port', '-1'],
    ['--port', '80.5']
  ])('refuses %s %s', (...argv) => {
    expect(parseArgs(argv)).toBeNull()
  })

  it('refuses a switch it does not know, rather than guess', () => {
    expect(parseArgs(['--host', '0.0.0.0'])).toBeNull()
  })
})
