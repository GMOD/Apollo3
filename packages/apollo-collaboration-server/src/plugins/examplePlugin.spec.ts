/**
 * Loads the example plugin (packages/apollo-plugin-example) into the real
 * plugin machinery, to make sure the plugin API works end to end.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { type Change, checkRegistry } from '@apollo-annotation/common'
import type {
  ApolloServerPlugin,
  ServerValidationContext,
} from '@apollo-annotation/common/server'
import { getConnectionToken } from '@nestjs/mongoose'
import { Test } from '@nestjs/testing'

import { serverChangeTypes } from '../changes/serverChangeTypes.js'
import { serverValidations } from '../utils/validation/ServerValidationSet.js'

import { APOLLO_PLUGINS } from './plugins.constants.js'
import { PluginsService } from './plugins.service.js'

// Loaded at runtime (rather than imported) so the example's source isn't part
// of this package's TypeScript build
const exampleSrc = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../apollo-plugin-example/src',
)
const { default: ApolloExampleServerPlugin } = (await import(
  path.join(exampleSrc, 'server/index.ts')
)) as { default: new () => ApolloServerPlugin }
const { ExampleNotesChange } = (await import(
  path.join(exampleSrc, 'shared/ExampleNotesChange.ts')
)) as { ExampleNotesChange: new (json: Record<string, unknown>) => Change }

function makeChange(newNotes: string[]) {
  return new ExampleNotesChange({
    typeName: 'ExampleNotesChange',
    assembly: 'assembly1',
    changedIds: ['feature1'],
    featureId: 'feature1',
    oldNotes: [],
    newNotes,
  })
}

describe('example plugin', () => {
  let pluginsService: PluginsService

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PluginsService,
        {
          provide: APOLLO_PLUGINS,
          useValue: [new ApolloExampleServerPlugin()],
        },
        { provide: getConnectionToken(), useValue: {} },
      ],
    }).compile()
    pluginsService = module.get(PluginsService)
    await pluginsService.onModuleInit()
  })

  it('registers its change type with a handler', () => {
    expect(serverChangeTypes.get('ExampleNotesChange').changeType).toBe(
      ExampleNotesChange,
    )
  })

  it('registers its check', () => {
    expect(checkRegistry.getCheck('ExampleShortFeatureCheck')).toBeDefined()
  })

  it('validates changes with its change rule', async () => {
    const context = {} as ServerValidationContext
    const okResult = await serverValidations.preValidate(
      makeChange(['ok']),
      context,
    )
    expect(okResult.ok).toBe(true)
    const tooLongResult = await serverValidations.preValidate(
      makeChange(['x'.repeat(1000)]),
      context,
    )
    expect(tooLongResult.ok).toBe(false)
    expect(tooLongResult.resultsMessages).toMatch(/at most/)
  })

  it('serves its route', () => {
    expect(
      pluginsService.findRoute(
        'GET',
        '/apollo-plugin-example/features/feature1/notes',
      )?.params,
    ).toEqual({ featureId: 'feature1' })
  })
})
