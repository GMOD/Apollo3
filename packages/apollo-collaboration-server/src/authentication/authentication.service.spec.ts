import { jest } from '@jest/globals'
import { BadRequestException, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { getConnectionToken } from '@nestjs/mongoose'
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
            get: jest.fn(
              (key: string) =>
                ({
                  URL: 'https://example.org/apollo/',
                  ALLOWED_REDIRECT_ORIGINS:
                    'https://jbrowse.example.org, https://other.example.org/path',
                  ALLOW_GUEST_USER: true,
                })[key],
            ),
          },
        },
        {
          provide: PluginsService,
          useValue: { getCustomAuthHandlers: () => customAuthTypes },
        },
        {
          provide: OidcService,
          useValue: {
            list: () => oidcProviders,
            has: (name: string) =>
              oidcProviders.some((provider) => provider.name === name),
          },
        },
        { provide: getConnectionToken(), useValue: {} },
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

  it('allows redirects to Apollo, configured origins, and loopback', () => {
    for (const uri of [
      'https://example.org/auth/device/complete',
      'https://jbrowse.example.org/?config=a',
      'https://other.example.org/',
      'http://localhost/auth',
      'http://127.0.0.1:8999/',
    ]) {
      expect(() => {
        service.assertAllowedRedirectUri(uri)
      }).not.toThrow()
    }
  })

  it('rejects redirects to other origins', () => {
    for (const uri of [
      'https://evil.example.com/',
      'http://example.org/',
      'https://jbrowse.example.org:8443/',
      'javascript:alert(1)',
      'not a url',
    ]) {
      expect(() => {
        service.assertAllowedRedirectUri(uri)
      }).toThrow(BadRequestException)
    }
    expect(() =>
      service.getTokenRedirectUrl('https://evil.example.com/', 'abc'),
    ).toThrow(BadRequestException)
  })
})

function decode(token: string) {
  return JSON.parse(token) as { role: string; email: string }
}

describe('AuthenticationService.logIn with Apollo-UserRole', () => {
  interface StoredUser {
    id: string
    email: string
    username: string
    role: string
  }

  let service: AuthenticationService
  let users: StoredUser[]
  let evaluateSecurityHook: jest.Mock<
    (name: string, extendee: unknown, props: unknown) => Promise<unknown>
  >
  const sign = jest.fn((payload: object) => JSON.stringify(payload))
  const connection = { name: 'connection' }

  beforeEach(async () => {
    users = [
      { id: '1', email: 'admin@example.org', username: 'A', role: 'admin' },
      { id: '2', email: 'old@example.org', username: 'O', role: 'readOnly' },
    ]
    evaluateSecurityHook = jest.fn((_name, extendee) =>
      Promise.resolve(extendee),
    )
    const usersService = {
      findByEmail: (email: string) =>
        Promise.resolve(users.find((user) => user.email === email) ?? null),
      findAll: () => Promise.resolve(users),
      addNew: (user: Omit<StoredUser, 'id'>) => {
        const created = { ...user, id: String(users.length + 1) }
        users.push(created)
        return Promise.resolve(created)
      },
      updateRole: (id: string, role: string) => {
        const user = users.find((user) => user.id === id)
        if (user) {
          user.role = role
        }
        return Promise.resolve(user ?? null)
      },
    }
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthenticationService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: { sign } },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(
              (key: string) =>
                ({
                  URL: 'https://example.org/apollo/',
                  DEFAULT_NEW_USER_ROLE: 'none',
                })[key],
            ),
          },
        },
        { provide: PluginsService, useValue: { evaluateSecurityHook } },
        { provide: OidcService, useValue: {} },
        { provide: getConnectionToken(), useValue: connection },
      ],
    }).compile()

    service = module.get<AuthenticationService>(AuthenticationService)
  })

  it('keeps the usual role when no plugin changes it', async () => {
    const { token } = await service.logIn('New', 'new@example.org', {
      loginType: 'keycloak',
    })
    expect(decode(token).role).toBe('none')
  })

  it('gives new users the role a plugin returns', async () => {
    evaluateSecurityHook.mockResolvedValue('user')
    const claims = { groups: ['curators'] }
    const { token } = await service.logIn('New', 'new@example.org', {
      loginType: 'keycloak',
      claims,
    })
    expect(decode(token).role).toBe('user')
    expect(users.at(-1)?.role).toBe('user')
    expect(evaluateSecurityHook).toHaveBeenCalledWith(
      'Apollo-UserRole',
      'none',
      {
        email: 'new@example.org',
        name: 'New',
        loginType: 'keycloak',
        claims,
        isNewUser: true,
        connection,
      },
    )
  })

  it('changes and saves the role of existing users', async () => {
    evaluateSecurityHook.mockResolvedValue('user')
    const { token } = await service.logIn('O', 'old@example.org', {
      loginType: 'orcid',
    })
    expect(decode(token).role).toBe('user')
    expect(users[1]?.role).toBe('user')
    expect(evaluateSecurityHook).toHaveBeenCalledWith(
      'Apollo-UserRole',
      'readOnly',
      expect.objectContaining({ isNewUser: false, loginType: 'orcid' }),
    )
  })

  it('keeps the role when a plugin returns undefined', async () => {
    evaluateSecurityHook.mockImplementation(() => Promise.resolve())
    const { token } = await service.logIn('O', 'old@example.org', {
      loginType: 'keycloak',
    })
    expect(decode(token).role).toBe('readOnly')
  })

  it('refuses the login when a plugin throws', async () => {
    evaluateSecurityHook.mockRejectedValue(new Error('IdP down'))
    await expect(
      service.logIn('O', 'old@example.org', { loginType: 'keycloak' }),
    ).rejects.toThrow(UnauthorizedException)
    await expect(
      service.logIn('New', 'new@example.org', { loginType: 'keycloak' }),
    ).rejects.toThrow(UnauthorizedException)
    expect(users).toHaveLength(2)
    expect(users[1]?.role).toBe('readOnly')
  })

  it('refuses the login when a plugin returns something that is not a role', async () => {
    evaluateSecurityHook.mockResolvedValue('superuser')
    await expect(
      service.logIn('O', 'old@example.org', { loginType: 'keycloak' }),
    ).rejects.toThrow(UnauthorizedException)
  })

  it('does not ask plugins about logins without a context', async () => {
    await service.logIn('Guest', 'guest_user')
    await service.logIn('root', 'root_user')
    expect(evaluateSecurityHook).not.toHaveBeenCalled()
  })
})
