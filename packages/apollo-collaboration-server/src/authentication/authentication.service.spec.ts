import { jest } from '@jest/globals'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { Test, type TestingModule } from '@nestjs/testing'

import { PluginsService } from '../plugins/plugins.service.js'
import { UsersService } from '../users/users.service.js'

import { AuthenticationService } from './authentication.service.js'
import type { OidcProviderConfig } from './oidc/oidc.config.js'
import { OidcService } from './oidc/oidc.service.js'

describe('AuthenticationService', () => {
  let service: AuthenticationService
  const oidcProviders: Partial<OidcProviderConfig>[] = [
    { name: 'google', displayName: 'Google' },
    { name: 'keycloak', displayName: 'University SSO' },
  ]
  const customAuthTypes = new Map([
    ['orcid', { message: 'Sign in with ORCID', needsPopup: true }],
    ['keycloak', { message: 'Custom keycloak', needsPopup: true }],
  ])

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthenticationService,
        { provide: UsersService, useValue: {} },
        { provide: JwtService, useValue: {} },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key) =>
              key === 'ALLOW_GUEST_USER' ? true : undefined,
            ),
          },
        },
        {
          provide: PluginsService,
          useValue: { evaluateExtensionPoint: () => customAuthTypes },
        },
        {
          provide: OidcService,
          useValue: {
            list: () => oidcProviders,
            has: (name: string) =>
              oidcProviders.some((provider) => provider.name === name),
          },
        },
      ],
    }).compile()

    service = module.get<AuthenticationService>(AuthenticationService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('lists custom, OIDC, and guest login types', () => {
    expect(service.getLoginTypes()).toEqual([
      { name: 'orcid', message: 'Sign in with ORCID', needsPopup: true },
      { name: 'google', message: 'Sign in with Google', needsPopup: true },
      {
        name: 'keycloak',
        message: 'Sign in with University SSO',
        needsPopup: true,
      },
      { name: 'guest', message: 'Continue as Guest', needsPopup: false },
    ])
  })

  it('adds the token to the redirect URL', () => {
    expect(
      service.getTokenRedirectUrl('http://localhost:3000/?config=a', 'abc'),
    ).toBe('http://localhost:3000/?access_token=abc')
  })
})
