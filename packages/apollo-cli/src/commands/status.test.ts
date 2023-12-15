import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { expect, test } from '@oclif/test'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

describe('status', () => {
  test
    .stdout()
    .command(['status'], { root: dirname(dirname(__dirname)) })
    .it('gives the status', (ctx) => {
      expect(ctx.stdout).to.contain("You're not logged in")
    })
})
