import { Change as BaseChange } from '@apollo-annotation/common'
import type { ServerChangeType } from '@apollo-annotation/common/server'
import {
  Assembly,
  Change,
  Feature,
  RefSeq,
  RefSeqChunk,
} from '@apollo-annotation/schemas'
import type { DecodedJWT } from '@apollo-annotation/shared'
import { jest } from '@jest/globals'
import { getModelToken } from '@nestjs/mongoose'
import { Test, type TestingModule } from '@nestjs/testing'

import { CountersService } from '../counters/counters.service.js'
import { MessagesGateway } from '../messages/messages.gateway.js'

import { ChangesService } from './changes.service.js'
import { serverChangeTypes } from './serverChangeTypes.js'

/** A plugin-style change that isn't assembly-specific */
class PluginChange extends BaseChange {
  typeName = 'TestPluginChange'
  toJSON() {
    return { typeName: this.typeName }
  }
  getInverse() {
    return this
  }
}

const user: DecodedJWT = {
  id: 'userId',
  username: 'Test User',
  email: 'test@example.com',
  role: 'user',
  iat: 0,
  exp: 0,
}

const session = { id: 'session' }
const deleteMany = () => ({ exec: () => Promise.resolve() })

describe('ChangesService', () => {
  let service: ChangesService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChangesService,
        {
          provide: getModelToken(Feature.name),
          useValue: {
            db: {
              transaction: (fn: (s: typeof session) => Promise<void>) =>
                fn(session),
            },
            deleteMany,
          },
        },
        { provide: getModelToken(Assembly.name), useValue: { deleteMany } },
        { provide: getModelToken(RefSeq.name), useValue: { deleteMany } },
        { provide: getModelToken(RefSeqChunk.name), useValue: { deleteMany } },
        {
          provide: getModelToken(Change.name),
          useValue: {
            create: () => Promise.resolve([{ _id: 'changeId', sequence: 1 }]),
          },
        },
        {
          provide: CountersService,
          useValue: { getNextSequenceValue: () => Promise.resolve(1) },
        },
        { provide: MessagesGateway, useValue: {} },
      ],
    }).compile()

    service = module.get<ChangesService>(ChangesService)
  })

  it('applies a plugin change type with its registered handler', async () => {
    const handler = jest.fn<ServerChangeType['handler']>()
    if (!serverChangeTypes.has('TestPluginChange')) {
      serverChangeTypes.register('TestPluginChange', {
        changeType: PluginChange,
        handler: (change, context) => handler(change, context),
      })
    }
    const change = new PluginChange({ typeName: 'TestPluginChange' })

    await service.create(change, user)

    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith(
      change,
      expect.objectContaining({
        session,
        user: {
          id: 'userId',
          username: 'Test User',
          email: 'test@example.com',
          role: 'user',
        },
      }),
    )
  })

  it('rejects a change type with no registered handler', async () => {
    const change = new PluginChange({ typeName: 'TestPluginChange' })
    change.typeName = 'UnregisteredChange'

    await expect(service.create(change, user)).rejects.toThrow(
      /No handler registered for change type "UnregisteredChange"/,
    )
  })
})
