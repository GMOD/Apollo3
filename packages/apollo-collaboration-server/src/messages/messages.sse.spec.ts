import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'

import type { INestApplication } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'

import { SSEClient } from '../test-utils/sseClient.js'

import { MessagesController } from './messages.controller.js'
import { MessagesService } from './messages.service.js'

/**
 * Exercises the SSE endpoint over real HTTP. Global auth guards are not
 * registered here; authentication is covered by the e2e tests.
 */
describe('GET /messages/events (SSE over HTTP)', () => {
  let app: INestApplication
  let service: MessagesService
  let url: string
  let clients: SSEClient[]

  async function connect() {
    const client = new SSEClient(url)
    clients.push(client)
    await client.connect()
    return client
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MessagesController],
      providers: [MessagesService],
    }).compile()

    app = module.createNestApplication({ logger: false })
    await app.listen(0, '127.0.0.1')
    const { port } = (app.getHttpServer() as Server).address() as AddressInfo
    url = `http://127.0.0.1:${port}/messages/events`
    service = app.get(MessagesService)
    clients = []
  })

  afterEach(async () => {
    await Promise.all(clients.map((client) => client.close()))
    await app.close()
  })

  it('responds with an event stream', async () => {
    const client = await connect()
    expect(client.response?.status).toBe(200)
    expect(client.response?.headers.get('content-type')).toMatch(
      /^text\/event-stream/,
    )
  })

  it('sends a broadcast as a named event with JSON data', async () => {
    const client = await connect()
    service.broadcast('COMMON', { hello: 'world' })
    const event = await client.nextEvent()
    expect(event.type).toBe('COMMON')
    expect(JSON.parse(event.data)).toEqual({ hello: 'world' })
  })

  it('uses channel names such as "<assembly>-<refSeq>" as event names', async () => {
    const client = await connect()
    service.broadcast('asm1-ctgA', { changeSequence: 1 })
    const event = await client.nextEvent()
    expect(event.type).toBe('asm1-ctgA')
    expect(JSON.parse(event.data)).toEqual({ changeSequence: 1 })
  })

  it('delivers several broadcasts in order', async () => {
    const client = await connect()
    service.broadcast('COMMON', { n: 1 })
    service.broadcast('USER_LOCATION', { n: 2 })
    service.broadcast('REQUEST_INFORMATION', { n: 3 })
    const events = [
      await client.nextEvent(),
      await client.nextEvent(),
      await client.nextEvent(),
    ]
    expect(events.map(({ type }) => type)).toEqual([
      'COMMON',
      'USER_LOCATION',
      'REQUEST_INFORMATION',
    ])
    expect(events.map(({ data }) => JSON.parse(data) as unknown)).toEqual([
      { n: 1 },
      { n: 2 },
      { n: 3 },
    ])
  })

  it('delivers each broadcast to every connected client', async () => {
    const first = await connect()
    const second = await connect()
    service.broadcast('COMMON', { hello: 'everyone' })
    const [firstEvent, secondEvent] = await Promise.all([
      first.nextEvent(),
      second.nextEvent(),
    ])
    expect(firstEvent).toEqual(secondEvent)
    expect(JSON.parse(firstEvent.data)).toEqual({ hello: 'everyone' })
  })

  it('keeps serving other clients after one disconnects', async () => {
    const leaving = await connect()
    const staying = await connect()
    await leaving.close()
    service.broadcast('COMMON', { still: 'here' })
    const event = await staying.nextEvent()
    expect(JSON.parse(event.data)).toEqual({ still: 'here' })
  })
})
