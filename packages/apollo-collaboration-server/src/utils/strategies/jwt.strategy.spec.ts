import { ConfigService } from '@nestjs/config'
import { Test, type TestingModule } from '@nestjs/testing'
import type { Request } from 'express'

import { JwtStrategy } from './jwt.strategy.js'

type TokenExtractor = (req: Request) => string | null

function makeRequest(
  headers: Record<string, string>,
  url = '/messages/events',
) {
  return { headers, url } as unknown as Request
}

describe('JwtStrategy', () => {
  let extractToken: TokenExtractor

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: ConfigService, useValue: { get: () => 'secret' } },
      ],
    }).compile()

    const strategy = module.get<JwtStrategy>(JwtStrategy)
    // passport-jwt stores the configured extractor on the strategy instance
    extractToken = (strategy as unknown as { _jwtFromRequest: TokenExtractor })
      ._jwtFromRequest
  })

  it('reads the token from a Bearer Authorization header', () => {
    const req = makeRequest({ authorization: 'Bearer header-token' })
    expect(extractToken(req)).toBe('header-token')
  })

  it('reads the token from the "token" query parameter', () => {
    const req = makeRequest({}, '/messages/events?token=query-token')
    expect(extractToken(req)).toBe('query-token')
  })

  it('prefers the Authorization header over the query parameter', () => {
    const req = makeRequest(
      { authorization: 'Bearer header-token' },
      '/messages/events?token=query-token',
    )
    expect(extractToken(req)).toBe('header-token')
  })

  it('returns null when no token is present', () => {
    expect(extractToken(makeRequest({}))).toBeNull()
  })
})
