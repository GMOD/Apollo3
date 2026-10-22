/**
 * Loads the example plugin (packages/apollo-plugin-example) into a real
 * JBrowse plugin manager and Apollo's client registries, to make sure the
 * client plugin API works end to end.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { checkRegistry } from '@apollo-annotation/common'
import type Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { describe, expect, it } from '@jest/globals'

import { registerPluginContributions } from './pluginContributions'
import { clientChangeTypes } from './session/clientChangeTypes'
import { clientValidations } from './validation/ClientValidationSet'

// Loaded at runtime (rather than imported) so the example's source isn't part
// of this package's TypeScript build
const exampleSrc = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../apollo-plugin-example/src',
)
const { default: ApolloExamplePlugin } = (await import(
  path.join(exampleSrc, 'index.ts')
)) as { default: new () => Plugin }
const { ExampleNotesChange } = (await import(
  path.join(exampleSrc, 'shared/ExampleNotesChange.ts')
)) as { ExampleNotesChange: unknown }

describe('example plugin', () => {
  it('registers its change type, check and change rule', () => {
    const pluginManager = new PluginManager([])
    new ApolloExamplePlugin().install(pluginManager)

    registerPluginContributions(pluginManager)

    expect(clientChangeTypes.get('ExampleNotesChange')?.changeType).toBe(
      ExampleNotesChange,
    )
    expect(checkRegistry.getCheck('ExampleShortFeatureCheck')).toBeDefined()
    expect([...clientValidations.rules].map((rule) => rule.name)).toContain(
      'ExampleNoteLengthRule',
    )
  })
})
