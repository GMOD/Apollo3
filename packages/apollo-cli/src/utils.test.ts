/* eslint-disable @typescript-eslint/no-floating-promises */
import assert from 'node:assert'
import { describe, it } from 'node:test'

import { createApiURL } from './utils.js'

describe('createApiURL', () => {
  const cases: [address: string, endpoint: string, expected: string][] = [
    ['https://example.org', 'assemblies', 'https://example.org/assemblies'],
    ['https://example.org/', 'assemblies', 'https://example.org/assemblies'],
    [
      'https://example.org/apollo',
      'assemblies',
      'https://example.org/apollo/assemblies',
    ],
    [
      'https://example.org/apollo/',
      'assemblies',
      'https://example.org/apollo/assemblies',
    ],
    [
      'https://example.org/apollo///',
      'assemblies',
      'https://example.org/apollo/assemblies',
    ],
    [
      'https://example.org/apollo',
      'auth/device/token',
      'https://example.org/apollo/auth/device/token',
    ],
    [
      'https://example.org/apollo',
      'sequence?start=1&end=10',
      'https://example.org/apollo/sequence?start=1&end=10',
    ],
    [
      'https://example.org/apollo',
      'https://files.example.org/genome.fa.fai',
      'https://files.example.org/genome.fa.fai',
    ],
  ]
  for (const [address, endpoint, expected] of cases) {
    it(`resolves "${endpoint}" against "${address}"`, () => {
      assert.strictEqual(createApiURL(address, endpoint).href, expected)
    })
  }

  it('replaces localhost with 127.0.0.1', () => {
    assert.strictEqual(
      createApiURL('http://localhost:3999', 'assemblies').href,
      'http://127.0.0.1:3999/assemblies',
    )
  })

  it('leaves hosts that only contain "localhost" alone', () => {
    assert.strictEqual(
      createApiURL('http://localhost.example.org', 'assemblies').href,
      'http://localhost.example.org/assemblies',
    )
  })

  it('throws for an address without a scheme', () => {
    assert.throws(() => createApiURL('example.org', 'assemblies'), TypeError)
  })
})
