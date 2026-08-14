import { Assembly, Feature, RefSeq } from '@apollo-annotation/schemas'
import { jest } from '@jest/globals'
import { Logger } from '@nestjs/common'
import { getConnectionToken, getModelToken } from '@nestjs/mongoose'
import { Test, type TestingModule } from '@nestjs/testing'

import { PluginsService } from '../plugins/plugins.service.js'
import { Role } from '../utils/role/role.enum.js'

import { AssemblyAccessService } from './assemblyAccess.service.js'

async function createService(pluginsService: Partial<PluginsService>) {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      AssemblyAccessService,
      { provide: getModelToken(Assembly.name), useValue: {} },
      { provide: getModelToken(RefSeq.name), useValue: {} },
      { provide: getModelToken(Feature.name), useValue: {} },
      { provide: getConnectionToken(), useValue: {} },
      { provide: PluginsService, useValue: pluginsService },
    ],
  }).compile()

  return module.get(AssemblyAccessService)
}

/** `evaluateSecurityHook` is generic, which jest.fn()'s own typing can't
 * express - this cast keeps the fake's implementation type-checked while
 * satisfying `PluginsService`'s public signature. */
function fakeEvaluateSecurityHook(
  impl: (
    name: string,
    extendee: unknown,
    props: Record<string, unknown>,
  ) => Promise<unknown>,
) {
  return jest.fn(impl) as unknown as PluginsService['evaluateSecurityHook']
}

const nonAdminUser = { email: 'user@example.com', role: Role.User }
const adminUser = { email: 'admin@example.com', role: Role.Admin }

describe('AssemblyAccessService', () => {
  it('leaves every user unrestricted when no plugin registers the hook', async () => {
    const service = await createService({
      hasHook: () => false,
      evaluateSecurityHook: fakeEvaluateSecurityHook((_name, extendee) =>
        Promise.resolve(extendee),
      ),
    })

    await expect(
      service.getAllowedAssemblyIds(nonAdminUser),
    ).resolves.toBeUndefined()
  })

  it('warns when a plugin is registered but evaluates to undefined', async () => {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => {})
    const service = await createService({
      hasHook: () => true,
      evaluateSecurityHook: fakeEvaluateSecurityHook((_name, extendee) =>
        Promise.resolve(extendee),
      ),
    })

    await service.getAllowedAssemblyIds(nonAdminUser)

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('all users have access to all assemblies'),
    )
    warn.mockRestore()
  })

  it('denies a non-admin user access to every assembly when the hook throws', async () => {
    const service = await createService({
      hasHook: () => true,
      evaluateSecurityHook: fakeEvaluateSecurityHook(() => {
        throw new Error('access check exploded')
      }),
    })

    await expect(service.getAllowedAssemblyIds(nonAdminUser)).resolves.toEqual(
      [],
    )
  })

  it('never restricts an admin user, even when the hook throws', async () => {
    const service = await createService({
      hasHook: () => true,
      evaluateSecurityHook: fakeEvaluateSecurityHook(() => {
        throw new Error('access check exploded')
      }),
    })

    await expect(
      service.getAllowedAssemblyIds(adminUser),
    ).resolves.toBeUndefined()
  })

  it('passes the Mongo connection to the Apollo-AssemblyAccess hook', async () => {
    const evaluateSecurityHookMock = jest.fn(
      (_name: string, extendee: unknown) => Promise.resolve(extendee),
    )
    const service = await createService({
      hasHook: () => false,
      evaluateSecurityHook:
        evaluateSecurityHookMock as unknown as PluginsService['evaluateSecurityHook'],
    })

    await service.getAllowedAssemblyIds(nonAdminUser)

    expect(evaluateSecurityHookMock).toHaveBeenCalledWith(
      'Apollo-AssemblyAccess',
      undefined,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      expect.objectContaining({ connection: expect.anything() }),
    )
  })
})
