import { jest } from '@jest/globals'
import { BadRequestException, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { Test, type TestingModule } from '@nestjs/testing'
import type { Request, Response } from 'express'

import { PluginsService } from '../plugins/plugins.service.js'
import { UsersService } from '../users/users.service.js'

import { AuthenticationService } from './authentication.service.js'
import type { OidcProviderConfig } from './oidc/oidc.config.js'
import { OidcService } from './oidc/oidc.service.js'

function mockResponse() {
  const cookie = jest.fn()
  const redirect = jest.fn()
  const response = { cookie, redirect } as unknown as Response
  return { response, cookie, redirect }
}

describe('AuthenticationService', () => {
  let service: AuthenticationService
  const usersService = { findById: jest.fn<(id: string) => Promise<unknown>>() }
  const jwtService = {
    sign: jest.fn<(payload: object, options: object) => string>(
      () => 'new-token',
    ),
  }
  const oidcProviders: Partial<OidcProviderConfig>[] = [
    { name: 'google', displayName: 'Google' },
    { name: 'keycloak', displayName: 'University SSO' },
  ]
  const handler = jest.fn(() =>
    Promise.resolve({ name: 'Some User', email: 'user@example.org' }),
  )
  const customAuthTypes = new Map([
    ['orcid', { message: 'Sign in with ORCID', needsPopup: true, handler }],
    ['keycloak', { message: 'Custom keycloak', needsPopup: true, handler }],
  ])

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthenticationService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
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

  it('allows same-origin path redirects, but not protocol-relative ones', () => {
    expect(() => {
      service.assertAllowedRedirectUri('/login?redirect_uri=%2F')
    }).not.toThrow()
    for (const uri of [
      '//evil.example.com/',
      String.raw`/\evil.example.com/`,
    ]) {
      expect(() => {
        service.assertAllowedRedirectUri(uri)
      }).toThrow(BadRequestException)
    }
  })

  it('leaves the token out of same-origin path redirects', () => {
    expect(service.getTokenRedirectUrl('/?config=a', 'abc')).toBe('/?config=a')
    expect(
      service.getLoginRedirectUrl('/login?redirect_uri=%2F', {
        error: 'Not approved',
      }),
    ).toBe('/login?redirect_uri=%2F&error=Not+approved')
  })

  describe('fallbackLogin', () => {
    beforeEach(() => {
      jest.spyOn(service, 'logIn').mockResolvedValue({ token: 'login-token' })
    })

    it('sets an auth cookie and redirects to the plain redirect_uri when there is no popup state', async () => {
      const { response, cookie, redirect } = mockResponse()
      const result = await service.fallbackLogin(
        'orcid',
        {} as Request,
        response,
        '/?config=a',
      )
      expect(result).toEqual({ token: 'login-token' })
      expect(cookie).toHaveBeenCalledWith(
        'apollo_jwt',
        'login-token',
        expect.objectContaining({ httpOnly: true }),
      )
      expect(redirect).toHaveBeenCalledWith('/?config=a')
    })

    it('sets an auth cookie and redirects with an access_token for a popup login', async () => {
      const { response, cookie, redirect } = mockResponse()
      await service.fallbackLogin(
        'orcid',
        {} as Request,
        response,
        undefined,
        JSON.stringify({ redirect_uri: 'http://localhost:3000/' }),
      )
      expect(cookie).toHaveBeenCalled()
      expect(redirect).toHaveBeenCalledWith(
        'http://localhost:3000/?access_token=login-token',
      )
    })

    it('redirects to a same-origin path as-is for a popup login, relying on the cookie', async () => {
      const { response, cookie, redirect } = mockResponse()
      await service.fallbackLogin(
        'orcid',
        {} as Request,
        response,
        undefined,
        JSON.stringify({ redirect_uri: '/login' }),
      )
      expect(cookie).toHaveBeenCalled()
      expect(redirect).toHaveBeenCalledWith('/login')
    })
  })

  describe('refreshToken', () => {
    const exp = Math.floor(Date.now() / 1000) + 3600

    it("issues a token with the user's current role and the same expiry", async () => {
      usersService.findById.mockResolvedValueOnce({
        id: 'user1',
        username: 'Some User',
        email: 'user@example.org',
        role: 'user',
      })
      const result = await service.refreshToken({ id: 'user1', exp })
      expect(result).toEqual({ token: 'new-token' })
      const [payload, options] = jwtService.sign.mock.lastCall ?? []
      expect(payload).toEqual({
        id: 'user1',
        username: 'Some User',
        email: 'user@example.org',
        role: 'user',
      })
      const { expiresIn } = options as { expiresIn: number }
      expect(expiresIn).toBeGreaterThan(3590)
      expect(expiresIn).toBeLessThanOrEqual(3600)
    })

    it('rejects requests without a valid token', async () => {
      await expect(service.refreshToken({ role: undefined })).rejects.toThrow(
        UnauthorizedException,
      )
    })

    it('rejects users that no longer exist', async () => {
      usersService.findById.mockResolvedValueOnce(null)
      await expect(service.refreshToken({ id: 'gone', exp })).rejects.toThrow(
        UnauthorizedException,
      )
    })
  })
})
