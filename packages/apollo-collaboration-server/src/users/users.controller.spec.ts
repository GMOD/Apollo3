import type { DecodedJWT } from '@apollo-annotation/shared'
import { jest } from '@jest/globals'
import { Test, type TestingModule } from '@nestjs/testing'
import type { Request } from 'express'

import { UsersController } from './users.controller.js'
import { UsersService } from './users.service.js'

const user = { id: 'user1', username: 'User One' } as DecodedJWT
const request = { user } as unknown as Request
const locations = [
  { assemblyId: 'asm1', refSeq: 'ctgA', start: '10', end: '20' },
]

describe('UsersController', () => {
  let controller: UsersController
  let broadcastLocation: jest.Mock

  beforeEach(async () => {
    broadcastLocation = jest.fn()
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: { broadcastLocation } }],
    }).compile()

    controller = module.get<UsersController>(UsersController)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  describe('userLoc', () => {
    it('broadcasts locations sent as a JSON array', () => {
      controller.userLoc(locations, request)
      expect(broadcastLocation).toHaveBeenCalledWith(locations, user)
    })

    it('broadcasts an empty location list', () => {
      controller.userLoc([], request)
      expect(broadcastLocation).toHaveBeenCalledWith([], user)
    })

    it('broadcasts locations sent in the legacy form-encoded format', () => {
      // What express's urlencoded parser makes of
      // `new URLSearchParams(JSON.stringify(locations))`
      const legacyBody = { [JSON.stringify(locations[0])]: '' }
      controller.userLoc(legacyBody, request)
      expect(broadcastLocation).toHaveBeenCalledWith(locations, user)
    })
  })
})
