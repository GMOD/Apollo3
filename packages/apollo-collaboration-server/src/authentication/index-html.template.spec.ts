import {
  getApiPrefixFromUrl,
  injectAuthRedirectScript,
} from './index-html.template.js'

describe('getApiPrefixFromUrl', () => {
  it('returns "/" for a bare origin with no path', () => {
    expect(getApiPrefixFromUrl('http://localhost:3999')).toBe('/')
  })

  it('adds a trailing slash to a path prefix that is missing one', () => {
    expect(getApiPrefixFromUrl('https://example.com/apollo')).toBe('/apollo/')
  })

  it('leaves an already-trailing-slash path prefix unchanged', () => {
    expect(getApiPrefixFromUrl('https://example.com/apollo/')).toBe('/apollo/')
  })
})

describe('injectAuthRedirectScript', () => {
  it('inserts a script tag right after the opening <head> tag', () => {
    const html = '<!doctype html><html><head><title>x</title></head></html>'
    const result = injectAuthRedirectScript(html, { apiPrefix: '/apollo/' })
    const headIndex = result.indexOf('<head>')
    const scriptIndex = result.indexOf('<script>')
    expect(scriptIndex).toBeGreaterThan(-1)
    expect(scriptIndex).toBeGreaterThan(headIndex)
    expect(scriptIndex).toBeLessThan(result.indexOf('<title>'))
  })

  it('embeds the api prefix as a safe JSON string literal', () => {
    const html = '<head></head>'
    const result = injectAuthRedirectScript(html, {
      apiPrefix: '/weird"</script>prefix/',
    })
    expect(result).toContain(JSON.stringify('/weird"</script>prefix/'))
  })

  it('falls back to prepending the script when there is no <head> tag', () => {
    const html = '<div>no head here</div>'
    const result = injectAuthRedirectScript(html, { apiPrefix: '/' })
    expect(result.indexOf('<script>')).toBe(0)
    expect(result).toContain(html)
  })

  it('preserves the rest of the document unchanged', () => {
    const html =
      '<!doctype html><html><head><title>x</title></head><body>hi</body></html>'
    const result = injectAuthRedirectScript(html, { apiPrefix: '/' })
    expect(result).toContain('<title>x</title>')
    expect(result).toContain('<body>hi</body>')
  })
})
