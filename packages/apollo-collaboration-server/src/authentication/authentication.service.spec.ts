import { jest } from '@jest/globals'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { Test, type TestingModule } from '@nestjs/testing'
import type { Request, Response } from 'express'

import { PluginsService } from '../plugins/plugins.service.js'
import { UsersService } from '../users/users.service.js'

import {
  AuthenticationService,
  type CustomAuthHandler,
} from './authentication.service.js'

function mockResponse() {
  const cookie = jest.fn()
  const redirect = jest.fn()
  const response = { cookie, redirect } as unknown as Response
  return { response, cookie, redirect }
}

describe('AuthenticationService', () => {
  let service: AuthenticationService
  let pluginsService: { evaluateExtensionPoint: jest.Mock }
  let usersService: {
    findByEmail: jest.Mock<(...args: unknown[]) => Promise<unknown>>
    findAll: jest.Mock
    addNew: jest.Mock
  }
  let jwtService: { sign: jest.Mock }

  beforeEach(async () => {
    pluginsService = { evaluateExtensionPoint: jest.fn() }
    usersService = {
      findByEmail: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
      findAll: jest.fn(),
      addNew: jest.fn(),
    }
    jwtService = { sign: jest.fn() }
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthenticationService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: PluginsService, useValue: pluginsService },
      ],
    }).compile()

    service = module.get<AuthenticationService>(AuthenticationService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('fallbackLogin', () => {
    beforeEach(() => {
      usersService.findByEmail.mockResolvedValue({
        id: 'user-id',
        username: 'Custom User',
        email: 'custom@example.com',
        role: 'user',
      })
      jwtService.sign.mockReturnValue('signed-jwt')
    })

    it('sets an auth cookie and redirects to the plain redirect_uri when the handler is not popup-based', async () => {
      const handler: CustomAuthHandler = {
        message: 'Custom',
        needsPopup: false,
        handler: () =>
          Promise.resolve({
            name: 'Custom User',
            email: 'custom@example.com',
          }),
      }
      pluginsService.evaluateExtensionPoint.mockReturnValue(
        new Map([['custom', handler]]),
      )
      const { response, cookie, redirect } = mockResponse()

      await service.fallbackLogin('custom', {} as Request, response, '/login')

      expect(cookie).toHaveBeenCalledWith(
        'apollo_jwt',
        'signed-jwt',
        expect.objectContaining({ httpOnly: true }),
      )
      expect(redirect).toHaveBeenCalledWith('/login')
    })

    it('redirects with an access_token query param when the handler needs a popup', async () => {
      const handler: CustomAuthHandler = {
        message: 'Custom',
        needsPopup: true,
        handler: () =>
          Promise.resolve({
            name: 'Custom User',
            email: 'custom@example.com',
          }),
      }
      pluginsService.evaluateExtensionPoint.mockReturnValue(
        new Map([['custom', handler]]),
      )
      const { response, cookie, redirect } = mockResponse()
      const state = JSON.stringify({ redirect_uri: 'https://example.com/cb' })

      await service.fallbackLogin(
        'custom',
        {} as Request,
        response,
        undefined,
        state,
      )

      expect(cookie).toHaveBeenCalled()
      expect(redirect).toHaveBeenCalledWith(
        'https://example.com/cb?access_token=signed-jwt',
      )
    })
  })
})
