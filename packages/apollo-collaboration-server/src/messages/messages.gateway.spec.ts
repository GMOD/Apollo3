import { Test, type TestingModule } from '@nestjs/testing'

import { MessagesGateway } from './messages.gateway.js'
import { MessagesService } from './messages.service.js'

describe('MessagesGateway', () => {
  let gateway: MessagesGateway

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MessagesGateway, MessagesService],
    }).compile()

    gateway = module.get<MessagesGateway>(MessagesGateway)
  })

  it('should be defined', () => {
    expect(gateway).toBeDefined()
  })
})
