import { User } from '@apollo-annotation/schemas'
import type { DecodedJWT } from '@apollo-annotation/shared'
import { jest } from '@jest/globals'
import { ConfigService } from '@nestjs/config'
import { getModelToken } from '@nestjs/mongoose'
import { Test, type TestingModule } from '@nestjs/testing'

import { MessagesService } from '../messages/messages.service.js'
import { Role } from '../utils/role/role.enum.js'

import { UsersService } from './users.service.js'

const user: DecodedJWT = {
  id: 'user1',
  email: 'user1@example.com',
  username: 'User One',
  role: Role.User,
  iat: 1_700_000_000,
  exp: 1_700_003_600,
}

describe('UsersService', () => {
  let service: UsersService
  let broadcast: jest.Mock
  let config: Record<string, unknown>

  beforeEach(async () => {
    broadcast = jest.fn()
    config = { BROADCAST_USER_LOCATION: true }
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getModelToken(User.name), useValue: {} },
        { provide: MessagesService, useValue: { broadcast } },
        {
          provide: ConfigService,
          useValue: { get: (key: string) => config[key] },
        },
      ],
    }).compile()

    service = module.get<UsersService>(UsersService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('broadcastLocation', () => {
    const locations = [
      { assemblyId: 'asm1', refSeq: 'ctgA', start: '100', end: '200' },
    ]

    it('broadcasts locations on the USER_LOCATION channel', () => {
      service.broadcastLocation(locations, user)
      expect(broadcast).toHaveBeenCalledTimes(1)
      expect(broadcast).toHaveBeenCalledWith('USER_LOCATION', {
        channel: 'USER_LOCATION',
        userName: 'User One',
        userSessionId: 'user1-1700000000',
        locations: [
          { assemblyId: 'asm1', refSeq: 'ctgA', start: 100, end: 200 },
        ],
      })
    })

    it('does not broadcast when BROADCAST_USER_LOCATION is false', () => {
      config.BROADCAST_USER_LOCATION = false
      service.broadcastLocation(locations, user)
      expect(broadcast).not.toHaveBeenCalled()
    })
  })

  describe('requestUsersLocations', () => {
    it('broadcasts a request on the REQUEST_INFORMATION channel', () => {
      service.requestUsersLocations(user)
      expect(broadcast).toHaveBeenCalledWith('REQUEST_INFORMATION', {
        channel: 'REQUEST_INFORMATION',
        userName: 'User One',
        userSessionId: 'user1-1700000000',
        reqType: 'CURRENT_LOCATION',
      })
    })
  })
})
