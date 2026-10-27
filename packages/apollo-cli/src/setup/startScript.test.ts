/* eslint-disable @typescript-eslint/no-floating-promises */
import assert from 'node:assert'
import { describe, it } from 'node:test'

import { renderStartScript } from './startScript.js'

describe('renderStartScript', () => {
  it('writes a shell script on Linux', () => {
    const { fileName, content } = renderStartScript(
      'linux',
      "/opt/bob's apollo",
    )
    assert.strictEqual(fileName, 'start-apollo.sh')
    assert.ok(content.startsWith('#!/bin/sh\n'))
    assert.ok(content.includes(String.raw`cd '/opt/bob'\''s apollo'`))
    assert.ok(content.includes('NODE_ENV=production exec node'))
    assert.ok(content.includes('--require ./current/.pnp.cjs'))
    assert.ok(
      content.includes('--experimental-loader ./current/.pnp.loader.mjs'),
    )
    assert.ok(
      content.includes(
        './current/packages/apollo-collaboration-server/dist/main.js',
      ),
    )
  })

  it('writes a .cmd script on Windows', () => {
    const { fileName, content } = renderStartScript(
      'win32',
      String.raw`C:\Apollo Server`,
    )
    assert.strictEqual(fileName, 'start-apollo.cmd')
    assert.ok(content.includes(String.raw`cd /d "C:\Apollo Server"`))
    assert.ok(content.includes('set NODE_ENV=production'))
    // The loader is given as a URL, with forward slashes
    assert.ok(
      content.includes('--experimental-loader ./current/.pnp.loader.mjs'),
    )
    assert.ok(
      content.includes(
        String.raw`current\packages\apollo-collaboration-server\dist\main.js`,
      ),
    )
    assert.ok(content.includes('\r\n'))
  })
})
