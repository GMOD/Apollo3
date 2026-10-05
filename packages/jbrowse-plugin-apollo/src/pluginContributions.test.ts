import {
  Change,
  ChangeRule,
  Check,
  type CheckResultSnapshot,
  type SerializedChange,
  changeRegistry,
  checkRegistry,
} from '@apollo-annotation/common'
import { ClientValidation } from '@apollo-annotation/common/client'
import type PluginManager from '@jbrowse/core/PluginManager'
import { describe, expect, it, jest } from '@jest/globals'

import { registerPluginContributions } from './pluginContributions'
import { clientChangeTypes } from './session/clientChangeTypes'
import { clientValidations } from './validation/ClientValidationSet'

class PluginChange extends Change {
  typeName = 'TestContributedChange'
  toJSON(): SerializedChange {
    return { typeName: this.typeName }
  }
  getInverse() {
    return this
  }
}

class PluginCheck extends Check {
  name = 'TestContributedCheck'
  version = 1
  causes = ['test']
  isDefault = false
  checkFeature(): Promise<CheckResultSnapshot[]> {
    return Promise.resolve([])
  }
}

class PluginRule extends ChangeRule {
  name = 'TestContributedRule'
  validate() {
    return
  }
}

class PluginValidation extends ClientValidation {
  name = 'TestContributedValidation'
}

/** Applies each registered callback in turn, like JBrowse does */
function makePluginManager(
  callbacks: Record<string, (extendee: unknown) => unknown>,
) {
  return {
    evaluateExtensionPoint: (name: string, extendee: unknown) =>
      name in callbacks ? callbacks[name](extendee) : extendee,
  } as unknown as PluginManager
}

function makeContributingPluginManager() {
  const handler = jest.fn()
  return makePluginManager({
    'Apollo-RegisterChangeTypes': (changeTypes) => ({
      ...(changeTypes as object),
      TestContributedChange: { changeType: PluginChange, handler },
    }),
    'Apollo-RegisterChecks': (checks) => [
      ...(checks as Check[]),
      new PluginCheck(),
    ],
    'Apollo-RegisterValidations': (validations) => [
      ...(validations as unknown[]),
      new PluginRule(),
      new PluginValidation(),
    ],
  })
}

describe('registerPluginContributions', () => {
  it('registers contributed change types, checks and validations', () => {
    registerPluginContributions(makeContributingPluginManager())

    expect(changeRegistry.getChangeType('TestContributedChange')).toBe(
      PluginChange,
    )
    expect(clientChangeTypes.get('TestContributedChange')?.changeType).toBe(
      PluginChange,
    )
    expect(checkRegistry.getCheck('TestContributedCheck')).toBeInstanceOf(
      PluginCheck,
    )
    expect(
      [...clientValidations.rules].filter(
        (rule) => rule.name === 'TestContributedRule',
      ),
    ).toHaveLength(1)
    expect(
      [...clientValidations.validations].filter(
        (validation) => validation.name === 'TestContributedValidation',
      ),
    ).toHaveLength(1)
  })

  it('can be run again, e.g. for a new plugin manager', () => {
    registerPluginContributions(makeContributingPluginManager())
    registerPluginContributions(makeContributingPluginManager())

    expect(
      [...clientValidations.validations].filter(
        (validation) => validation.name === 'TestContributedValidation',
      ),
    ).toHaveLength(1)
  })

  it('rejects a different change class under an existing name', () => {
    registerPluginContributions(makeContributingPluginManager())
    class OtherChange extends PluginChange {
      typeName = 'OtherChange'
    }
    const pluginManager = makePluginManager({
      'Apollo-RegisterChangeTypes': () => ({
        TestContributedChange: { changeType: OtherChange },
      }),
    })

    expect(() => {
      registerPluginContributions(pluginManager)
    }).toThrow(/already been registered/)
  })
})
