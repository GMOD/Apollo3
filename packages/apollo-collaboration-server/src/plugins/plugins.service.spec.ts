import {
  ApolloServerPlugin,
  type ApolloServerHookRegistrar,
  type AssemblyGrant,
  type Check,
  type ChangeConstructor,
  type CustomAuthHandler,
  type Validation,
  changeRegistry,
  checkRegistry,
} from '@apollo-annotation/common'
import { validationRegistry } from '@apollo-annotation/shared'
import { jest } from '@jest/globals'
import { getConnectionToken } from '@nestjs/mongoose'
import { Test, type TestingModule } from '@nestjs/testing'

import { APOLLO_PLUGINS } from './plugins.constants.js'
import { PluginsService } from './plugins.service.js'

let uniqueCounter = 0
/** Registries touched by these tests are process-wide singletons, so every
 * registered name/instance must be unique to this file's test run. */
function unique(prefix: string) {
  uniqueCounter += 1
  return `${prefix}${uniqueCounter}`
}

const noopHandler = () => Promise.resolve()

class FakePlugin extends ApolloServerPlugin {
  constructor(
    public name: string,
    private readonly installFn: (
      registrar: ApolloServerHookRegistrar,
    ) => void | Promise<void> = () => {
      // no-op by default
    },
  ) {
    super()
  }

  install(registrar: ApolloServerHookRegistrar) {
    return this.installFn(registrar)
  }
}

async function createService(
  plugins: ApolloServerPlugin[],
  connection: unknown = {},
) {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      PluginsService,
      { provide: APOLLO_PLUGINS, useValue: plugins },
      { provide: getConnectionToken(), useValue: connection },
    ],
  }).compile()

  return module.get(PluginsService)
}

describe('PluginsService', () => {
  it('should be defined', async () => {
    const service = await createService([])
    expect(service).toBeDefined()
  })

  describe('onModuleInit', () => {
    it('calls install() on every plugin', async () => {
      const installA = jest.fn<(registrar: ApolloServerHookRegistrar) => void>()
      const installB = jest.fn<(registrar: ApolloServerHookRegistrar) => void>()
      const service = await createService([
        new FakePlugin('a', installA),
        new FakePlugin('b', installB),
      ])

      await service.onModuleInit()

      expect(installA).toHaveBeenCalledTimes(1)
      expect(installB).toHaveBeenCalledTimes(1)
    })

    it('hands the injected Mongo connection to Apollo-MongoDB hooks', async () => {
      const connection = { id: 'fake-connection' }
      const received: unknown[] = []
      const service = await createService(
        [
          new FakePlugin('mongo-plugin', (registrar) => {
            registrar.registerHook('Apollo-MongoDB', (_extendee, props) => {
              received.push(props.connection)
            })
          }),
        ],
        connection,
      )

      await service.onModuleInit()

      expect(received).toEqual([connection])
    })

    it('folds Apollo-RegisterRoutes contributions from every plugin into pluginRoutes', async () => {
      const routeA = { method: 'GET', path: '/a', handler: noopHandler }
      const routeB = { method: 'GET', path: '/b', handler: noopHandler }
      const service = await createService([
        new FakePlugin('a', (registrar) => {
          registrar.registerHook('Apollo-RegisterRoutes', (routes) => {
            routes.push(routeA)
            return routes
          })
        }),
        new FakePlugin('b', (registrar) => {
          registrar.registerHook('Apollo-RegisterRoutes', (routes) => {
            routes.push(routeB)
            return routes
          })
        }),
      ])

      await service.onModuleInit()

      expect(service.pluginRoutes).toEqual([routeA, routeB])
    })

    it('aborts startup when a startup-fatal hook throws', async () => {
      const service = await createService([
        new FakePlugin('broken-routes-plugin', (registrar) => {
          registrar.registerHook('Apollo-RegisterRoutes', () => {
            throw new Error('boom')
          })
        }),
      ])

      await expect(service.onModuleInit()).rejects.toThrow('boom')
    })

    it('collects custom auth handlers once, reused by getCustomAuthHandlers()', async () => {
      const registerCustomAuth = jest.fn(
        (handlers: Map<string, CustomAuthHandler>) => {
          handlers.set('my-auth', {
            message: 'Sign in with my auth',
            needsPopup: false,
            handler: () =>
              Promise.resolve({ name: 'A User', email: 'a@example.com' }),
          })
          return handlers
        },
      )
      const service = await createService([
        new FakePlugin('auth-plugin', (registrar) => {
          registrar.registerHook(
            'Apollo-RegisterCustomAuth',
            registerCustomAuth,
          )
        }),
      ])

      await service.onModuleInit()
      const first = service.getCustomAuthHandlers()
      const second = service.getCustomAuthHandlers()

      expect(first).toBe(second)
      expect(first.has('my-auth')).toBe(true)
      expect(registerCustomAuth).toHaveBeenCalledTimes(1)
    })

    it('registers plugin-contributed Change types into the shared changeRegistry', async () => {
      const name = unique('TestChange')
      // eslint-disable-next-line @typescript-eslint/no-extraneous-class
      class FakeChange {}
      const service = await createService([
        new FakePlugin('change-plugin', (registrar) => {
          registrar.registerHook('Apollo-RegisterChangeTypes', (types) => ({
            ...types,
            [name]: FakeChange as unknown as ChangeConstructor,
          }))
        }),
      ])

      await service.onModuleInit()

      expect(changeRegistry.getChangeType(name)).toBe(FakeChange)
    })

    it('registers plugin-contributed Checks into the shared checkRegistry', async () => {
      const name = unique('TestCheck')
      const check = {
        name,
        version: 1,
        causes: [],
        isDefault: false,
        checkFeature: () => Promise.resolve([]),
      } as unknown as Check
      const service = await createService([
        new FakePlugin('check-plugin', (registrar) => {
          registrar.registerHook('Apollo-RegisterChecks', (checks) => [
            ...checks,
            check,
          ])
        }),
      ])

      await service.onModuleInit()

      expect(checkRegistry.getCheck(name)).toBe(check)
    })

    it('registers plugin-contributed Validations into the shared validationRegistry', async () => {
      const validation = { name: unique('TestValidation') } as Validation
      const service = await createService([
        new FakePlugin('validation-plugin', (registrar) => {
          registrar.registerHook(
            'Apollo-RegisterValidations',
            (validations) => [...validations, validation],
          )
        }),
      ])

      await service.onModuleInit()

      expect(validationRegistry.validations.has(validation)).toBe(true)
    })
  })

  describe('evaluateSecurityHook', () => {
    it('returns the seed unchanged when no plugin registers the hook', async () => {
      const service = await createService([])
      await service.onModuleInit()

      const result = await service.evaluateSecurityHook<
        Map<string, AssemblyGrant> | undefined
      >('Apollo-AssemblyAccess', undefined, {})

      expect(result).toBeUndefined()
    })

    it('folds registered callbacks and returns the final value', async () => {
      const grants = new Map<string, AssemblyGrant>([['a@example.com', '*']])
      const service = await createService([
        new FakePlugin('access-plugin', (registrar) => {
          registrar.registerHook('Apollo-AssemblyAccess', () => grants)
        }),
      ])
      await service.onModuleInit()

      const result = await service.evaluateSecurityHook<
        Map<string, AssemblyGrant> | undefined
      >('Apollo-AssemblyAccess', undefined, {})

      expect(result).toBe(grants)
    })

    it('rethrows rather than swallowing a callback error, so callers can fail closed', async () => {
      const service = await createService([
        new FakePlugin('broken-access-plugin', (registrar) => {
          registrar.registerHook('Apollo-AssemblyAccess', () => {
            throw new Error('access check exploded')
          })
        }),
      ])
      await service.onModuleInit()

      await expect(
        service.evaluateSecurityHook('Apollo-AssemblyAccess', undefined, {}),
      ).rejects.toThrow('access check exploded')
    })
  })

  describe('hasHook', () => {
    it('reflects whether any plugin has registered a given hook', async () => {
      const service = await createService([
        new FakePlugin('access-plugin', (registrar) => {
          registrar.registerHook('Apollo-AssemblyAccess', () => {
            // no-op - only registration is being tested here
          })
        }),
      ])

      expect(service.hasHook('Apollo-AssemblyAccess')).toBe(false)

      await service.onModuleInit()

      expect(service.hasHook('Apollo-AssemblyAccess')).toBe(true)
      expect(service.hasHook('Apollo-RegisterCustomAuth')).toBe(false)
    })
  })
})
