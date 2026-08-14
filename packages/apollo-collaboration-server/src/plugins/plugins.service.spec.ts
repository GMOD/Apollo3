import { Test, type TestingModule } from '@nestjs/testing'

import { APOLLO_PLUGINS } from './plugins.constants.js'
import { PluginsService } from './plugins.service.js'

describe('PluginsService', () => {
  let service: PluginsService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PluginsService, { provide: APOLLO_PLUGINS, useValue: [] }],
    }).compile()

    service = module.get<PluginsService>(PluginsService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})
