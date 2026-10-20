import type { MessageEvent } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'
import { firstValueFrom, take, toArray } from 'rxjs'

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

  it('delivers each broadcast to every subscriber', async () => {
    const first = firstValueFrom(service.subscribe())
    const second = firstValueFrom(service.subscribe())
    service.broadcast('USER_LOCATION', { a: 1 })
    const expected = { type: 'USER_LOCATION', data: { a: 1 } }
    await expect(first).resolves.toEqual(expected)
    await expect(second).resolves.toEqual(expected)
  })

  it('delivers broadcasts in order', async () => {
    const events = firstValueFrom(service.subscribe().pipe(take(3), toArray()))
    service.broadcast('COMMON', { n: 1 })
    service.broadcast('asm1-ctgA', { n: 2 })
    service.broadcast('COMMON', { n: 3 })
    await expect(events).resolves.toEqual([
      { type: 'COMMON', data: { n: 1 } },
      { type: 'asm1-ctgA', data: { n: 2 } },
      { type: 'COMMON', data: { n: 3 } },
    ])
  })

  it('does not replay broadcasts sent before subscribing', async () => {
    service.broadcast('COMMON', { n: 'before' })
    const eventPromise = firstValueFrom(service.subscribe())
    service.broadcast('COMMON', { n: 'after' })
    await expect(eventPromise).resolves.toEqual({
      type: 'COMMON',
      data: { n: 'after' },
    })
  })

  it('stops delivering to unsubscribed subscribers', () => {
    const received: MessageEvent[] = []
    const subscription = service
      .subscribe()
      .subscribe((event) => received.push(event))
    service.broadcast('COMMON', { n: 1 })
    subscription.unsubscribe()
    service.broadcast('COMMON', { n: 2 })
    expect(received).toEqual([{ type: 'COMMON', data: { n: 1 } }])
  })
})
