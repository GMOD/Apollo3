import { Test, type TestingModule } from '@nestjs/testing'
import { firstValueFrom } from 'rxjs'

import { MessagesService } from './messages.service.js'

describe('MessagesService', () => {
  let service: MessagesService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MessagesService],
    }).compile()

    service = module.get<MessagesService>(MessagesService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('delivers broadcast messages to subscribers as named SSE events', async () => {
    const eventPromise = firstValueFrom(service.subscribe())
    service.broadcast('COMMON', { hello: 'world' })
    await expect(eventPromise).resolves.toEqual({
      type: 'COMMON',
      data: { hello: 'world' },
    })
  })
})
