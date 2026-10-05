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
    await expect(eventPromise).resolves.toMatchObject({
      type: 'COMMON',
      data: { hello: 'world' },
    })
  })

  it('delivers each broadcast to every subscriber', async () => {
    const first = firstValueFrom(service.subscribe())
    const second = firstValueFrom(service.subscribe())
    service.broadcast('USER_LOCATION', { a: 1 })
    const expected = { type: 'USER_LOCATION', data: { a: 1 } }
    await expect(first).resolves.toMatchObject(expected)
    await expect(second).resolves.toMatchObject(expected)
  })

  it('delivers broadcasts in order', async () => {
    const events = firstValueFrom(service.subscribe().pipe(take(3), toArray()))
    service.broadcast('COMMON', { n: 1 })
    service.broadcast('asm1-ctgA', { n: 2 })
    service.broadcast('COMMON', { n: 3 })
    await expect(events).resolves.toMatchObject([
      { type: 'COMMON', data: { n: 1 } },
      { type: 'asm1-ctgA', data: { n: 2 } },
      { type: 'COMMON', data: { n: 3 } },
    ])
  })

  it('does not replay broadcasts sent before subscribing', async () => {
    service.broadcast('COMMON', { n: 'before' })
    const eventPromise = firstValueFrom(service.subscribe())
    service.broadcast('COMMON', { n: 'after' })
    await expect(eventPromise).resolves.toMatchObject({
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
    expect(received).toMatchObject([{ type: 'COMMON', data: { n: 1 } }])
  })
  it('gives each event a unique ID', async () => {
    const events = firstValueFrom(service.subscribe().pipe(take(2), toArray()))
    service.broadcast('COMMON', { n: 1 })
    service.broadcast('COMMON', { n: 2 })
    const received = await events
    const ids = received.map(({ id }) => id)
    expect(ids).toEqual([expect.any(String), expect.any(String)])
    expect(new Set(ids).size).toBe(2)
  })
})
