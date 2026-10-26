import { jest } from '@jest/globals'
import { type ExecutionContext, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'

import { Role } from '../role/role.enum.js'

import { AuthorizationGuard } from './authorization.guard.js'

class AssembliesController {
  findAll() {
    return 'assemblies'
  }
}

function makeContext(user?: { role?: Role; username?: string }) {
  return {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    getHandler: () => AssembliesController.prototype.findAll,
    getClass: () => AssembliesController,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext
}

describe('AuthorizationGuard', () => {
  let reflector: Reflector
  let guard: AuthorizationGuard

  beforeEach(() => {
    reflector = new Reflector()
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(Role.User)
    guard = new AuthorizationGuard(reflector)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('allows the request through when the user has the required role', () => {
    expect(guard.canActivate(makeContext({ role: Role.Admin }))).toBe(true)
  })

  it('throws UnauthorizedException when the request has no user at all', () => {
    expect(() => guard.canActivate(makeContext())).toThrow(
      UnauthorizedException,
    )
  })

  it('throws UnauthorizedException when the user role is None', () => {
    expect(() => guard.canActivate(makeContext({ role: Role.None }))).toThrow(
      UnauthorizedException,
    )
  })

  it('returns false (403) when logged in but lacking the required role', () => {
    expect(guard.canActivate(makeContext({ role: Role.ReadOnly }))).toBe(false)
  })

  it('returns false when the authorization check itself throws', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation(() => {
      throw new Error('boom')
    })
    expect(guard.canActivate(makeContext({ role: Role.Admin }))).toBe(false)
  })
})
