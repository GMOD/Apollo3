/* eslint-disable @typescript-eslint/no-floating-promises */
import assert from 'node:assert'
import path from 'node:path'
import { describe, it } from 'node:test'

import type { ObjectSchema } from 'joi'

import type { SetupAnswers } from './answers.js'
import { maskEnv, parseEnv, quoteEnvValue, renderEnv } from './env.js'

// Imported by a computed path so tsc doesn't pull the server's source into
// this package's build
const schemaPath = path.resolve(
  import.meta.dirname,
  '../../../apollo-collaboration-server/src/configValidationSchema.ts',
)
const { validationSchema } = (await import(schemaPath)) as {
  validationSchema: ObjectSchema
}

const baseAnswers: SetupAnswers = {
  installDir: '/opt/apollo',
  apolloVersion: '1.3.0',
  jbrowseDir: '/var/www/jbrowse',
  jbrowseConfigFiles: ['config.json'],
  url: 'http://localhost:3999',
  port: 3999,
  name: 'Apollo',
  description: '',
  mongodb: { type: 'existing', uri: 'mongodb://localhost:27017/apolloDb' },
  defaultNewUserRole: 'none',
  uploadDir: '/opt/apollo/uploads',
  jwtSecret: 'jwt-secret',
  sessionSecret: 'session-secret',
}

function validate(envText: string) {
  const env = Object.fromEntries(parseEnv(envText))
  // The server allows unknown keys (Nest's default), e.g. MONGOMS_DOWNLOAD_DIR
  return validationSchema.validate(env, { allowUnknown: true }).error?.message
}

describe('renderEnv', () => {
  const cases: [label: string, answers: SetupAnswers][] = [
    ['existing MongoDB, no logins', baseAnswers],
    [
      'embedded MongoDB',
      {
        ...baseAnswers,
        mongodb: { type: 'embedded', dataDir: '/opt/apollo/data/mongodb' },
      },
    ],
    [
      'root and guest',
      {
        ...baseAnswers,
        rootUser: { password: 'p@ss word#1' },
        guestUser: { role: 'readOnly' },
      },
    ],
    [
      'Google and Microsoft, with several configs',
      {
        ...baseAnswers,
        jbrowseConfigFiles: ['config.json', 'mouse/config_mouse.json'],
        description: 'A server with "quotes" in its description',
        google: { clientId: 'gid', clientSecret: 'gsecret' },
        microsoft: { clientId: 'mid', clientSecret: 'msecret' },
        initialAdminEmail: 'admin@example.org',
        defaultNewUserRole: 'user',
      },
    ],
  ]
  for (const [label, answers] of cases) {
    it(`passes the server's schema: ${label}`, () => {
      assert.strictEqual(validate(renderEnv(answers)), undefined)
    })
  }

  it('round-trips values through parseEnv', () => {
    const answers: SetupAnswers = {
      ...baseAnswers,
      name: "Bob's server",
      description: 'Uses "quotes" and # signs',
      rootUser: { password: 'a b#c\'d"e' },
    }
    const env = parseEnv(renderEnv(answers))
    assert.strictEqual(env.get('NAME'), "Bob's server")
    assert.strictEqual(env.get('DESCRIPTION'), 'Uses "quotes" and # signs')
    assert.strictEqual(env.get('ROOT_USER_PASSWORD'), 'a b#c\'d"e')
    assert.strictEqual(env.get('JBROWSE_CONFIG_FILES'), 'config.json')
    assert.strictEqual(env.get('PLUGIN_LOCATION'), 'apollo-v1.3.0.js')
  })

  it('sets MONGOMS_DOWNLOAD_DIR only for embedded MongoDB', () => {
    assert.ok(!parseEnv(renderEnv(baseAnswers)).has('MONGOMS_DOWNLOAD_DIR'))
    const env = parseEnv(
      renderEnv({
        ...baseAnswers,
        mongodb: { type: 'embedded', dataDir: '/opt/apollo/data/mongodb' },
      }),
    )
    assert.strictEqual(
      env.get('MONGOMS_DOWNLOAD_DIR'),
      path.join('/opt/apollo', 'mongodb-binaries'),
    )
    assert.ok(!env.has('MONGODB_URI'))
  })

  it('keeps unmanaged settings and drops replaced _FILE ones', () => {
    const previous = new Map([
      ['LOG_LEVELS', 'error,warn'],
      ['URL', 'http://old.example.org'],
      ['JWT_SECRET_FILE', '/run/secrets/jwt'],
    ])
    const envText = renderEnv(baseAnswers, previous)
    const env = parseEnv(envText)
    assert.strictEqual(env.get('LOG_LEVELS'), 'error,warn')
    assert.strictEqual(env.get('URL'), 'http://localhost:3999')
    assert.ok(!env.has('JWT_SECRET_FILE'))
    assert.strictEqual(validate(envText), undefined)
  })
})

describe('quoteEnvValue', () => {
  it('leaves simple values bare', () => {
    assert.strictEqual(
      quoteEnvValue('http://a.org:3999/x'),
      'http://a.org:3999/x',
    )
  })
  it('quotes values with spaces or # signs', () => {
    assert.strictEqual(quoteEnvValue('a b'), "'a b'")
    assert.strictEqual(quoteEnvValue("it's #1"), '"it\'s #1"')
  })
  it('rejects values it cannot quote', () => {
    assert.throws(() => quoteEnvValue('a\nb'))
  })
})

describe('maskEnv', () => {
  it('masks secrets only', () => {
    const masked = maskEnv(
      renderEnv({ ...baseAnswers, rootUser: { password: 'hunter2' } }),
    )
    assert.ok(!masked.includes('hunter2'))
    assert.ok(!masked.includes('jwt-secret'))
    assert.ok(masked.includes('ROOT_USER_PASSWORD=********'))
    assert.ok(masked.includes('NAME=Apollo'))
  })
})
