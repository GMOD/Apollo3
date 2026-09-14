import type { ConfigService } from '@nestjs/config'

import { serveStaticFactory, validationSchema } from './app.module.js'

const baseEnv = {
  URL: 'http://localhost:3999',
  NAME: 'Test Server',
  MONGODB_URI: 'mongodb://localhost:27017/test',
  FILE_UPLOAD_FOLDER: './test/uploaded',
  JWT_SECRET: 'secret',
  SESSION_SECRET: 'secret',
}

describe('validationSchema JBROWSE_DIR / JBROWSE_DEV_SERVER_URL', () => {
  it('accepts JBROWSE_DIR on its own', () => {
    const { error } = validationSchema.validate({
      ...baseEnv,
      JBROWSE_DIR: './assets',
    })
    expect(error).toBeUndefined()
  })

  it('accepts JBROWSE_DEV_SERVER_URL on its own', () => {
    const { error } = validationSchema.validate({
      ...baseEnv,
      JBROWSE_DEV_SERVER_URL: 'http://localhost:3000',
    })
    expect(error).toBeUndefined()
  })

  it('rejects having neither set', () => {
    const { error } = validationSchema.validate(baseEnv)
    expect(error).toBeDefined()
  })

  it('rejects having both set', () => {
    const { error } = validationSchema.validate({
      ...baseEnv,
      JBROWSE_DIR: './assets',
      JBROWSE_DEV_SERVER_URL: 'http://localhost:3000',
    })
    expect(error).toBeDefined()
  })
})

describe('serveStaticFactory', () => {
  it('serves nothing from disk when JBROWSE_DEV_SERVER_URL is set instead of JBROWSE_DIR', () => {
    const configService = {
      get: (key: string) =>
        key === 'JBROWSE_DEV_SERVER_URL' ? 'http://localhost:3000' : undefined,
    } as unknown as ConfigService<
      { JBROWSE_DIR?: string; JBROWSE_DEV_SERVER_URL?: string },
      true
    >
    expect(serveStaticFactory(configService)).toEqual([])
  })
})
