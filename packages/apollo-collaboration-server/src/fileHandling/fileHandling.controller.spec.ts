import { Test, TestingModule } from '@nestjs/testing'
import { FileHandlingController } from './fileHandling.controller'

describe('FileHandlingController', () => {
  let controller: FileHandlingController

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FileHandlingController],
    }).compile()

    controller = module.get<FileHandlingController>(FileHandlingController)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })
})
