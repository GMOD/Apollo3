import { type Change, ChangeRule } from '@apollo-annotation/common'
import {
  type ServerPostValidationContext,
  ServerValidation,
  type ServerValidationContext,
} from '@apollo-annotation/common/server'

import { ServerValidationSet } from './ServerValidationSet.js'

const change = { typeName: 'TestChange' } as unknown as Change
const context = {} as ServerValidationContext
const postContext = {} as ServerPostValidationContext

class Rule extends ChangeRule {
  constructor(
    public name: string,
    private readonly message?: string,
    private readonly calls: string[] = [],
  ) {
    super()
  }

  validate() {
    this.calls.push(this.name)
    return this.message
  }
}

class PreOnly extends ServerValidation {
  name = 'PreOnly'
  constructor(private readonly calls: string[]) {
    super()
  }
  preValidate() {
    this.calls.push(this.name)
    return Promise.resolve()
  }
}

class PostRejects extends ServerValidation {
  name = 'PostRejects'
  postValidate() {
    return 'nope'
  }
}

describe('ServerValidationSet', () => {
  it('runs change rules before server validations', async () => {
    const calls: string[] = []
    const set = new ServerValidationSet()
    set.register(new PreOnly(calls))
    set.register(new Rule('Rule', undefined, calls))

    const results = await set.preValidate(change, context)

    expect(results.ok).toBe(true)
    expect(calls).toEqual(['Rule', 'PreOnly'])
  })

  it('stops at the first rejection', async () => {
    const calls: string[] = []
    const set = new ServerValidationSet()
    set.register(new Rule('First', 'bad change', calls))
    set.register(new Rule('Second', undefined, calls))
    set.register(new PreOnly(calls))

    const results = await set.preValidate(change, context)

    expect(results.ok).toBe(false)
    expect(results.resultsMessages).toBe('bad change')
    expect(calls).toEqual(['First'])
  })

  it('does not run change rules after the change is applied', async () => {
    const calls: string[] = []
    const set = new ServerValidationSet()
    set.register(new Rule('Rule', 'bad change', calls))
    set.register(new PreOnly(calls))

    const results = await set.postValidate(change, postContext)

    expect(results.ok).toBe(true)
    expect(calls).toEqual([])
  })

  it('reports post-validation rejections', async () => {
    const set = new ServerValidationSet()
    set.register(new PostRejects())

    const results = await set.postValidate(change, postContext)

    expect(results.ok).toBe(false)
    expect(results.resultsMessages).toBe('nope')
  })
})
