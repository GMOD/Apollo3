import { Test, type TestingModule } from '@nestjs/testing'

import { FilesController } from './files.controller.js'
import { FilesInterceptor } from './files.interceptor.js'
import { FilesService } from './files.service.js'

describe('FilesController', () => {
  let controller: FilesController

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FilesController],
      providers: [
        { provide: FilesService, useValue: {} },
        { provide: FilesInterceptor, useValue: {} },
      ],
    }).compile()

    controller = module.get<FilesController>(FilesController)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })
})
