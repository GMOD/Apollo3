import {
  parseCommaSeparatedList,
  parsePluginIntegrity,
} from './pluginConfig.js'

const hash = 'a'.repeat(64)

describe('parseCommaSeparatedList', () => {
  it('trims entries and drops empty ones', () => {
    expect(parseCommaSeparatedList(' a, b ,,c ')).toEqual(['a', 'b', 'c'])
    expect(parseCommaSeparatedList('')).toEqual([])
    expect(parseCommaSeparatedList()).toEqual([])
  })
})

describe('parsePluginIntegrity', () => {
  it('parses url=hash pairs', () => {
    const integrity = parsePluginIntegrity(
      `https://example.com/a.mjs=${hash}, https://example.com/b.mjs=${'B'.repeat(64)}`,
    )
    expect(integrity.get('https://example.com/a.mjs')).toBe(hash)
    expect(integrity.get('https://example.com/b.mjs')).toBe('b'.repeat(64))
  })

  it('handles URLs containing "="', () => {
    const url = 'https://example.com/plugin.mjs?version=2&x=y'
    expect(parsePluginIntegrity(`${url}=${hash}`).get(url)).toBe(hash)
  })

  it.each([
    'https://example.com/a.mjs',
    `=${hash}`,
    'https://example.com/a.mjs=nothex',
    'https://example.com/a.mjs=abc123',
  ])('rejects malformed entry %p', (entry) => {
    expect(() => parsePluginIntegrity(entry)).toThrow(/PLUGIN_INTEGRITY/)
  })
})
