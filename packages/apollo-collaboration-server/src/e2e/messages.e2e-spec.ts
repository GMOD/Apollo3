/**
 * Tests that server-sent events reach clients of every server process. Each
 * Nest module here stands in for one server process (e.g. a PM2 worker), and
 * they share a MongoDB database, configured with:
 * - MONGODB_URI (default mongodb://localhost:27017/?directConnection=true)
 */
import type { MessageEvent } from '@nestjs/common'
import { MongooseModule, getConnectionToken } from '@nestjs/mongoose'
import { Test, type TestingModule } from '@nestjs/testing'
import type { Connection } from 'mongoose'
import { firstValueFrom, take, toArray } from 'rxjs'

import {
  EVENTS_COLLECTION_NAME,
  MessagesService,
} from '../messages/messages.service.js'

const mongodbURI =
  process.env.MONGODB_URI ?? 'mongodb://localhost:27017/?directConnection=true'
const dbName = `apolloTestEvents${Date.now()}`

async function startProcess() {
  const module = await Test.createTestingModule({
    imports: [MongooseModule.forRoot(mongodbURI, { dbName })],
    providers: [MessagesService],
  }).compile()
  await module.init()
  return module
}

function nextEvents(service: MessagesService, count: number) {
  return firstValueFrom(service.subscribe().pipe(take(count), toArray()))
}

function withoutIds(events: MessageEvent[]) {
  return events.map(({ type, data }) => ({ type, data }))
}

describe('MessagesService across server processes', () => {
  let modules: TestingModule[]
  let services: [MessagesService, MessagesService]
  let connection: Connection

  beforeAll(async () => {
    // Start them at the same time so they race to create the collection
    const [firstModule, secondModule] = await Promise.all([
      startProcess(),
      startProcess(),
    ])
    modules = [firstModule, secondModule]
    services = [
      firstModule.get(MessagesService),
      secondModule.get(MessagesService),
    ]
    connection = firstModule.get<Connection>(getConnectionToken())
  })

  afterAll(async () => {
    // Stop following events before the collection is dropped
    await Promise.all(
      modules.map((module) => module.get(MessagesService).onModuleDestroy()),
    )
    await connection.dropDatabase()
    await Promise.all(modules.map((module) => module.close()))
  })

  it('creates a capped events collection', async () => {
    const collection = connection.collection(EVENTS_COLLECTION_NAME)
    await expect(collection.isCapped()).resolves.toBe(true)
  })

  it('delivers a broadcast to subscribers of every process, in order', async () => {
    const [first, second] = services
    const firstReceived = nextEvents(first, 3)
    const secondReceived = nextEvents(second, 3)
    first.broadcast('COMMON', { n: 1 })
    second.broadcast('asm1-ctgA', { n: 2 })
    // Wait so the order of the third broadcast is certain
    await nextEvents(first, 2)
    first.broadcast('USER_LOCATION', { n: 3 })

    const firstEvents = await firstReceived
    const secondEvents = await secondReceived
    expect(withoutIds(firstEvents.slice(2))).toEqual([
      { type: 'USER_LOCATION', data: { n: 3 } },
    ])
    // Both processes see the same events in the same order with the same IDs
    expect(secondEvents).toEqual(firstEvents)
    expect(withoutIds(firstEvents)).toEqual(
      expect.arrayContaining([
        { type: 'COMMON', data: { n: 1 } },
        { type: 'asm1-ctgA', data: { n: 2 } },
      ]),
    )
  })

  it('delivers each broadcast only once', async () => {
    const [first, second] = services
    const received: MessageEvent[] = []
    const subscription = second
      .subscribe()
      .subscribe((event) => received.push(event))
    first.broadcast('COMMON', { once: true })
    await nextEvents(first, 1)
    // Give any duplicate time to arrive
    await new Promise((resolve) => setTimeout(resolve, 500))
    subscription.unsubscribe()
    expect(withoutIds(received)).toEqual([
      { type: 'COMMON', data: { once: true } },
    ])
  })

  it('keeps delivering after its cursor closes', async () => {
    const [first, second] = services
    // Simulate a dropped connection to MongoDB
    await (
      second as unknown as { cursor: { close(): Promise<void> } }
    ).cursor.close()
    const received = nextEvents(second, 1)
    first.broadcast('COMMON', { afterReconnect: true })
    await expect(received.then(withoutIds)).resolves.toEqual([
      { type: 'COMMON', data: { afterReconnect: true } },
    ])
  })

  it('does not redeliver earlier events to a process that starts later', async () => {
    const [first] = services
    first.broadcast('COMMON', { early: true })
    await nextEvents(first, 1)

    const late = await startProcess()
    modules.push(late)
    const lateService = late.get(MessagesService)
    const received = nextEvents(lateService, 1)
    first.broadcast('COMMON', { late: true })
    await expect(received.then(withoutIds)).resolves.toEqual([
      { type: 'COMMON', data: { late: true } },
    ])
  })
})
