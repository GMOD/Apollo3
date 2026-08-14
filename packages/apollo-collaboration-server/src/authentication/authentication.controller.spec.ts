import { Test, type TestingModule } from '@nestjs/testing'

import { AuthenticationController } from './authentication.controller.js'
import { AuthenticationService } from './authentication.service.js'

describe('AuthenticationController', () => {
  let controller: AuthenticationController

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthenticationController],
      providers: [{ provide: AuthenticationService, useValue: {} }],
    }).compile()

    controller = module.get<AuthenticationController>(AuthenticationController)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })
})
