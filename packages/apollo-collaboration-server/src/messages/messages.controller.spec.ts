import { RequestMethod } from '@nestjs/common'
import {
  METHOD_METADATA,
  PATH_METADATA,
  SSE_METADATA,
} from '@nestjs/common/constants.js'
import { Reflector } from '@nestjs/core'
import { Test, type TestingModule } from '@nestjs/testing'
import { firstValueFrom } from 'rxjs'

import { Role } from '../utils/role/role.enum.js'
import { ROLE_KEY } from '../utils/validation/validatation.decorator.js'

import { MessagesController } from './messages.controller.js'
import { MessagesService } from './messages.service.js'

// Nest stores route metadata on the handler function itself
const eventsHandler = Object.getOwnPropertyDescriptor(
  MessagesController.prototype,
  'events',
)?.value as object

describe('MessagesController', () => {
  let controller: MessagesController
  let service: MessagesService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MessagesController],
      providers: [MessagesService],
    }).compile()

    controller = module.get<MessagesController>(MessagesController)
    service = module.get<MessagesService>(MessagesService)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  it('streams events broadcast by the service', async () => {
    const eventPromise = firstValueFrom(controller.events())
    service.broadcast('COMMON', { hello: 'world' })
    await expect(eventPromise).resolves.toEqual({
      type: 'COMMON',
      data: { hello: 'world' },
    })
  })

  it('exposes events() as a GET SSE route at /messages/events', () => {
    const handler = eventsHandler
    expect(Reflect.getMetadata(PATH_METADATA, MessagesController)).toBe(
      'messages',
    )
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe('events')
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(
      RequestMethod.GET,
    )
    expect(Reflect.getMetadata(SSE_METADATA, handler)).toBe(true)
  })

  it('requires the ReadOnly role', () => {
    const reflector = new Reflector()
    const role = reflector.getAllAndOverride<Role>(ROLE_KEY, [
      eventsHandler as () => void,
      MessagesController,
    ])
    expect(role).toBe(Role.ReadOnly)
  })
})
