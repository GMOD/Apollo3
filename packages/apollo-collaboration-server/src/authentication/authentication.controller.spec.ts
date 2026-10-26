import { jest } from '@jest/globals'
import { BadRequestException } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'
import type { Request, Response } from 'express'

import { AuthenticationController } from './authentication.controller.js'
import { AuthenticationService } from './authentication.service.js'
import { DeviceLoginService } from './device/device-login.service.js'
import { OidcService } from './oidc/oidc.service.js'

describe('AuthenticationController', () => {
  let controller: AuthenticationController

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthenticationController],
      providers: [
        {
          provide: AuthenticationService,
          useValue: {
            assertAllowedRedirectUri: jest.fn(),
            oauthLogIn: jest.fn(() => Promise.resolve({ token: 'abc' })),
            getLoginRedirectUrl: jest.fn(() => 'http://localhost:3000/#token'),
          },
        },
        {
          provide: OidcService,
          useValue: {
            has: () => true,
            finishLogin: jest.fn(() =>
              Promise.resolve({
                name: 'Some User',
                email: 'user@example.org',
                redirectUri: 'http://localhost:3000/',
              }),
            ),
          },
        },
        { provide: DeviceLoginService, useValue: {} },
      ],
    }).compile()

    controller = module.get<AuthenticationController>(AuthenticationController)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  it('passes redirect_uri and prompt on to the login type', () => {
    expect(controller.handleLogin('guest')).toEqual({ url: 'guest' })
    expect(
      controller.handleLogin(
        'google',
        'http://localhost:3000/',
        'select_account',
      ),
    ).toEqual({
      url: 'google?redirect_uri=http%3A%2F%2Flocalhost%3A3000%2F&prompt=select_account',
    })
  })

  it('rejects unsupported prompts', () => {
    expect(() =>
      controller.handleLogin('google', 'http://localhost:3000/', 'none'),
    ).toThrow(BadRequestException)
  })

  it("ignores the identity provider's own prompt when it redirects back", async () => {
    const req = {
      query: { code: 'xyz', prompt: 'none' },
    } as unknown as Request
    const redirect = jest.fn()
    const cookie = jest.fn()
    const res = { redirect, cookie } as unknown as Response
    await controller.fallbackLogin(
      'google',
      req,
      res,
      undefined,
      undefined,
      'none',
    )
    expect(redirect).toHaveBeenCalledWith('http://localhost:3000/#token')
  })
})
