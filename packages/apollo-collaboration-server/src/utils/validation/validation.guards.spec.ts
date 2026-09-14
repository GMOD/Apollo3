import { validationRegistry } from '@apollo-annotation/shared'
import type { ValidationResultSet } from '@apollo-annotation/shared'
import { jest } from '@jest/globals'
import {
  ForbiddenException,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'

import { Role } from '../role/role.enum.js'

import { ValidationGuard } from './validation.guards.js'

function makeContext(user?: { role?: Role }): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext
}

function mockValidationResult(ok: boolean) {
  return jest
    .spyOn(validationRegistry, 'backendPreValidate')
    .mockResolvedValue({
      ok,
      results: [],
      resultsMessages: ok ? '' : 'Not authorized!',
    } as unknown as ValidationResultSet)
}

describe('ValidationGuard', () => {
  let guard: ValidationGuard

  beforeEach(() => {
    guard = new ValidationGuard(new Reflector())
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('allows the request through when validation passes', async () => {
    mockValidationResult(true)
    await expect(
      guard.canActivate(makeContext({ role: Role.Admin })),
    ).resolves.toBe(true)
  })

  it('throws UnauthorizedException when the request has no user at all', async () => {
    mockValidationResult(false)
    await expect(guard.canActivate(makeContext())).rejects.toThrow(
      UnauthorizedException,
    )
  })

  it('throws UnauthorizedException when the user role is None', async () => {
    mockValidationResult(false)
    await expect(
      guard.canActivate(makeContext({ role: Role.None })),
    ).rejects.toThrow(UnauthorizedException)
  })

  it('throws ForbiddenException when authenticated but lacking the required role', async () => {
    mockValidationResult(false)
    await expect(
      guard.canActivate(makeContext({ role: Role.ReadOnly })),
    ).rejects.toThrow(ForbiddenException)
  })

  it('returns false when backendPreValidate itself throws unexpectedly', async () => {
    jest
      .spyOn(validationRegistry, 'backendPreValidate')
      .mockRejectedValue(new Error('boom'))
    await expect(
      guard.canActivate(makeContext({ role: Role.Admin })),
    ).resolves.toBe(false)
  })
})
