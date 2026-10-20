import {
  Assembly,
  Change,
  Feature,
  RefSeq,
  RefSeqChunk,
} from '@apollo-annotation/schemas'
import {
  AddRefSeqAliasesChange,
  type DecodedJWT,
  LocationEndChange,
} from '@apollo-annotation/shared'
import { jest } from '@jest/globals'
import { getModelToken } from '@nestjs/mongoose'
import { Test, type TestingModule } from '@nestjs/testing'

import { CountersService } from '../counters/counters.service.js'
import { MessagesService } from '../messages/messages.service.js'

import { ChangeHandlersService } from './changeHandlers.service.js'
import { ChangesService } from './changes.service.js'

const user: DecodedJWT = {
  id: 'user1',
  email: 'user1@example.com',
  username: 'User One',
  role: 'admin',
  iat: 1_700_000_000,
  exp: 1_700_003_600,
}

function exec<T>(value: T) {
  return { exec: () => Promise.resolve(value) }
}

describe('ChangesService', () => {
  let service: ChangesService
  let broadcast: jest.Mock
  // Maps a changed feature ID to the name of the refSeq it is on
  let featureRefNames: Record<string, string>

  beforeEach(async () => {
    broadcast = jest.fn()
    featureRefNames = {}
    const featureModel = {
      findOne: ({ allIds }: { allIds: string }) =>
        exec(allIds in featureRefNames ? { refSeq: allIds } : null),
      db: {
        transaction: async (fn: (session: object) => Promise<void>) => {
          await fn({})
        },
      },
    }
    const refSeqModel = {
      findById: (featureId: string) =>
        exec({ name: featureRefNames[featureId] }),
    }
    const changeModel = {
      create: ([doc]: [object]) =>
        Promise.resolve([{ ...doc, _id: 'change1', sequence: 42 }]),
    }
    const changeHandlers = {
      LocationEndChange: () => Promise.resolve(),
      AddRefSeqAliasesChange: () => Promise.resolve(),
    }
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChangesService,
        { provide: getModelToken(Feature.name), useValue: featureModel },
        { provide: getModelToken(Assembly.name), useValue: {} },
        { provide: getModelToken(RefSeq.name), useValue: refSeqModel },
        { provide: getModelToken(RefSeqChunk.name), useValue: {} },
        { provide: getModelToken(Change.name), useValue: changeModel },
        {
          provide: CountersService,
          useValue: { getNextSequenceValue: () => Promise.resolve(42) },
        },
        { provide: MessagesService, useValue: { broadcast } },
        { provide: ChangeHandlersService, useValue: changeHandlers },
      ],
    }).compile()

    service = module.get<ChangesService>(ChangesService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('broadcasts a feature change on each affected assembly-refSeq channel', async () => {
    featureRefNames = { feature1: 'ctgA', feature2: 'ctgB' }
    const change = new LocationEndChange({
      typeName: 'LocationEndChange',
      assembly: 'asm1',
      changedIds: ['feature1', 'feature2'],
      changes: [
        { featureId: 'feature1', oldEnd: 100, newEnd: 110 },
        { featureId: 'feature2', oldEnd: 200, newEnd: 210 },
      ],
    })

    await service.create(change, user)

    const expectedMessage = {
      changeInfo: change.toJSON(),
      userName: 'User One',
      userSessionId: 'user1-1700000000',
      changeSequence: 42,
    }
    expect(broadcast).toHaveBeenCalledTimes(2)
    expect(broadcast).toHaveBeenCalledWith('asm1-ctgA', {
      ...expectedMessage,
      channel: 'asm1-ctgA',
    })
    expect(broadcast).toHaveBeenCalledWith('asm1-ctgB', {
      ...expectedMessage,
      channel: 'asm1-ctgB',
    })
  })

  it('broadcasts other assembly-specific changes on the COMMON channel', async () => {
    const change = new AddRefSeqAliasesChange({
      typeName: 'AddRefSeqAliasesChange',
      assembly: 'asm1',
      refSeqAliases: [{ refName: 'ctgA', aliases: ['chrA'] }],
    })

    await service.create(change, user)

    expect(broadcast).toHaveBeenCalledTimes(1)
    expect(broadcast).toHaveBeenCalledWith('COMMON', {
      changeInfo: change.toJSON(),
      userName: 'User One',
      userSessionId: 'user1-1700000000',
      channel: 'COMMON',
      changeSequence: 42,
    })
  })
})
