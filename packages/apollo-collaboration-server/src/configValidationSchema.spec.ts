import { validationSchema } from './configValidationSchema.js'

const requiredConfig = {
  URL: 'http://localhost:3999',
  NAME: 'Test',
  MONGODB_URI: 'mongodb://localhost:27017/test',
  FILE_UPLOAD_FOLDER: '/data',
  JWT_SECRET: 'secret',
  SESSION_SECRET: 'secret',
}

function validate(extra: Record<string, string>) {
  return validationSchema.validate({ ...requiredConfig, ...extra }).error
    ?.message
}

describe('config validation schema, plugin options', () => {
  it('accepts no plugin configuration', () => {
    expect(validate({})).toBeUndefined()
  })

  it('accepts PLUGIN_URLS or PLUGIN_URLS_FILE on its own', () => {
    expect(
      validate({ PLUGIN_URLS: 'https://example.com/a.mjs' }),
    ).toBeUndefined()
    expect(validate({ PLUGIN_URLS_FILE: '/data/plugin-urls' })).toBeUndefined()
  })

  it('rejects both PLUGIN_URLS and PLUGIN_URLS_FILE', () => {
    expect(
      validate({
        PLUGIN_URLS: 'https://example.com/a.mjs',
        PLUGIN_URLS_FILE: '/data/plugin-urls',
      }),
    ).toMatch(/PLUGIN_URLS/)
  })

  it('rejects an invalid PLUGIN_URLS entry', () => {
    expect(
      validate({ PLUGIN_URLS: 'https://example.com/a.mjs,not a url' }),
    ).toMatch(/PLUGIN_URLS/)
  })

  it('validates PLUGIN_INTEGRITY', () => {
    expect(
      validate({
        PLUGIN_INTEGRITY: `https://example.com/a.mjs?v=1=${'a'.repeat(64)}`,
      }),
    ).toBeUndefined()
    expect(
      validate({ PLUGIN_INTEGRITY: 'https://example.com/a.mjs=abc' }),
    ).toMatch(/PLUGIN_INTEGRITY/)
  })

  it('accepts PLUGIN_CACHE_DIR', () => {
    expect(validate({ PLUGIN_CACHE_DIR: '/data/cache' })).toBeUndefined()
  })
})
