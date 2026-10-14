import { jest } from '@jest/globals'
import { Test, type TestingModule } from '@nestjs/testing'
import type { Request, Response } from 'express'

import { AuthenticationController } from './authentication.controller.js'
import { AuthenticationService } from './authentication.service.js'
import { DeviceLoginService } from './device/device-login.service.js'
import { OidcService } from './oidc/oidc.service.js'

describe('AuthenticationController', () => {
  let controller: AuthenticationController
  const claims = { email: 'a@example.org', groups: ['curators'] }
  const authService = {
    assertAllowedRedirectUri: jest.fn(),
    logIn: jest.fn(() => Promise.resolve({ token: 'abc' })),
    getTokenRedirectUrl: jest.fn(
      (uri: string, token: string) => `${uri}?access_token=${token}`,
    ),
  }
  const oidcService = {
    has: (name: string) => name === 'keycloak',
    finishLogin: jest.fn(() =>
      Promise.resolve({
        name: 'A',
        email: 'a@example.org',
        claims,
        redirectUri: 'https://example.org/',
      }),
    ),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthenticationController],
      providers: [
        { provide: AuthenticationService, useValue: authService },
        { provide: OidcService, useValue: oidcService },
        { provide: DeviceLoginService, useValue: {} },
      ],
    }).compile()

    controller = module.get<AuthenticationController>(AuthenticationController)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  it('logs in with the OIDC provider name and claims', async () => {
    const redirect = jest.fn()
    await controller.fallbackLogin(
      'keycloak',
      { query: { code: 'xyz' } } as unknown as Request,
      { redirect } as unknown as Response,
    )
    expect(authService.logIn).toHaveBeenCalledWith('A', 'a@example.org', {
      loginType: 'keycloak',
      claims,
    })
    expect(redirect).toHaveBeenCalledWith(
      'https://example.org/?access_token=abc',
    )
  })
})
