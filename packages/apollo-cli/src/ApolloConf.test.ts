/* eslint-disable @typescript-eslint/no-floating-promises */
import assert from 'node:assert'
import { describe, it } from 'node:test'

import { validateAddress } from './ApolloConf.js'

describe('validateAddress', () => {
  for (const address of [
    'http://localhost:3999',
    'https://example.org',
    'https://example.org/apollo/',
  ]) {
    it(`accepts "${address}"`, () => {
      assert.strictEqual(validateAddress(address), undefined)
    })
  }

  for (const address of [
    'example.org',
    'localhost:3999',
    'ftp://example.org',
    'http://bad host',
    '',
  ]) {
    it(`rejects "${address}"`, () => {
      assert.match(
        validateAddress(address) ?? '',
        /^"?Address"? (must be an http:\/\/ or https:\/\/ URL|is not allowed to be empty)/,
      )
    })
  }
})
