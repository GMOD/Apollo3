import { jest } from '@jest/globals'
import { Test, type TestingModule } from '@nestjs/testing'

import { JBrowseController } from './jbrowse.controller.js'
import { JBrowseService } from './jbrowse.service.js'

describe('JBrowseController', () => {
  let controller: JBrowseController

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [JBrowseController],
      providers: [{ provide: JBrowseService, useValue: {} }],
    }).compile()

    controller = module.get<JBrowseController>(JBrowseController)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })
})

async function createController(getConfig: (...args: unknown[]) => unknown) {
  const module: TestingModule = await Test.createTestingModule({
    controllers: [JBrowseController],
    providers: [{ provide: JBrowseService, useValue: { getConfig } }],
  }).compile()
  return module.get(JBrowseController)
}

describe('JBrowseController config.json', () => {
  it('forwards the configId query param to JBrowseService.getConfig', async () => {
    const getConfig = jest.fn().mockReturnValue({ assemblies: [] })
    const controller = await createController(getConfig)
    const request = {
      user: { role: 'admin', id: 'user-1', iat: 1_700_000_000 },
    }
    await controller.config(
      request as unknown as Parameters<typeof controller.config>[0],
      'config_mouse.json',
    )
    expect(getConfig).toHaveBeenCalledWith(
      { id: 'user-1', iat: 1_700_000_000, role: 'admin' },
      'config_mouse.json',
    )
  })

  it('forwards undefined when no configId query param is present', async () => {
    const getConfig = jest.fn().mockReturnValue({ assemblies: [] })
    const controller = await createController(getConfig)
    const request = {
      user: { role: 'admin', id: 'user-1', iat: 1_700_000_000 },
    }
    await controller.config(
      request as unknown as Parameters<typeof controller.config>[0],
    )
    expect(getConfig).toHaveBeenCalledWith(
      { id: 'user-1', iat: 1_700_000_000, role: 'admin' },
      undefined,
    )
  })

  it('throws when there is no user on the request', async () => {
    const controller = await createController(jest.fn())
    const request = { user: undefined }
    expect(() =>
      controller.config(
        request as unknown as Parameters<typeof controller.config>[0],
      ),
    ).toThrow('No user for request')
  })
})
