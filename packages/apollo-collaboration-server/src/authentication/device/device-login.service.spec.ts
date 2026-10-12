/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-empty-function */
import { DeviceLogin } from '@apollo-annotation/schemas'
import { jest } from '@jest/globals'
import { BadRequestException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { getModelToken } from '@nestjs/mongoose'
import { Test, type TestingModule } from '@nestjs/testing'

import { AuthenticationService } from '../authentication.service.js'

import {
  DeviceLoginService,
  formatUserCode,
  normalizeUserCode,
} from './device-login.service.js'

interface FakeDoc {
  deviceCodeHash: string
  userCode: string
  type: string
  status: 'pending' | 'approved'
  token?: string
  lastPolledAt?: Date
  createdAt: Date
  save: () => Promise<void>
  deleteOne: () => Promise<void>
}

/** Just enough of a Mongoose model for DeviceLoginService */
function createFakeModel() {
  const docs: FakeDoc[] = []
  return {
    docs,
    create: jest.fn(
      async (data: Pick<FakeDoc, 'deviceCodeHash' | 'userCode' | 'type'>) => {
        const doc: FakeDoc = {
          ...data,
          status: 'pending',
          createdAt: new Date(),
          save: async () => {},
          deleteOne: async () => {
            docs.splice(docs.indexOf(doc), 1)
          },
        }
        docs.push(doc)
        return doc
      },
    ),
    findOne: (filter: Partial<FakeDoc>) => ({
      exec: async () =>
        docs.find((doc) =>
          Object.entries(filter).every(
            ([key, value]) => doc[key as keyof FakeDoc] === value,
          ),
        ) ?? null,
    }),
  }
}

describe('DeviceLoginService', () => {
  let service: DeviceLoginService
  let model: ReturnType<typeof createFakeModel>
  const verifyAsync = jest.fn(async (token: string) => {
    if (token !== 'valid-jwt') {
      throw new Error('invalid signature')
    }
    return {}
  })

  beforeEach(async () => {
    model = createFakeModel()
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeviceLoginService,
        { provide: getModelToken(DeviceLogin.name), useValue: model },
        {
          provide: AuthenticationService,
          useValue: {
            getLoginTypes: () => [
              { name: 'google', message: '', needsPopup: true },
              { name: 'guest', message: '', needsPopup: false },
            ],
          },
        },
        { provide: JwtService, useValue: { verifyAsync } },
        {
          provide: ConfigService,
          useValue: { get: () => 'https://example.org/apollo' },
        },
      ],
    }).compile()

    service = module.get<DeviceLoginService>(DeviceLoginService)
  })

  it('creates a device login', async () => {
    const result = await service.create('google')
    expect(result.user_code).toMatch(
      /^[B-DF-HJ-NP-TV-XZ]{4}-[B-DF-HJ-NP-TV-XZ]{4}$/,
    )
    expect(result.device_code.length).toBeGreaterThanOrEqual(43)
    expect(result.verification_uri).toBe(
      'https://example.org/apollo/auth/device',
    )
    expect(result.verification_uri_complete).toBe(
      `https://example.org/apollo/auth/device?user_code=${result.user_code}`,
    )
    expect(result.interval).toBe(5)
    // Only a hash of the device code is stored
    const [doc] = model.docs
    expect(doc?.deviceCodeHash).not.toBe(result.device_code)
    expect(doc?.userCode).toBe(normalizeUserCode(result.user_code))
  })

  it('rejects unknown and non-browser login types', async () => {
    await expect(service.create('nope')).rejects.toThrow(BadRequestException)
    await expect(service.create('guest')).rejects.toThrow(BadRequestException)
  })

  it('finds pending logins by code, ignoring case and hyphens', async () => {
    const { user_code } = await service.create('google')
    expect(await service.findPending(user_code.toLowerCase())).toBeDefined()
    expect(await service.findPending(user_code.replace('-', ''))).toBeDefined()
    expect(await service.findPending('BBBB-BBBB')).toBeUndefined()
  })

  it('formats codes', () => {
    expect(formatUserCode('BCDFGHJK')).toBe('BCDF-GHJK')
    expect(normalizeUserCode(' bcdf-ghjk ')).toBe('BCDFGHJK')
  })

  it('goes from pending to approved, and returns the token once', async () => {
    const { device_code, user_code } = await service.create('google')
    expect(await service.poll(device_code)).toEqual({
      error: 'authorization_pending',
    })
    // Polling again right away is too fast
    expect(await service.poll(device_code)).toEqual({ error: 'slow_down' })

    expect(await service.approve(user_code, 'bad-jwt')).toBe(false)
    expect(await service.approve(user_code, 'valid-jwt')).toBe(true)
    // Can't approve twice
    expect(await service.approve(user_code, 'valid-jwt')).toBe(false)

    expect(await service.poll(device_code)).toEqual({ token: 'valid-jwt' })
    expect(await service.poll(device_code)).toEqual({ error: 'expired_token' })
    expect(model.docs).toHaveLength(0)
  })

  it('treats unknown and expired device codes as expired', async () => {
    expect(await service.poll('unknown')).toEqual({ error: 'expired_token' })
    const { device_code, user_code } = await service.create('google')
    for (const doc of model.docs) {
      doc.createdAt = new Date(Date.now() - 11 * 60 * 1000)
    }
    expect(await service.poll(device_code)).toEqual({ error: 'expired_token' })
    expect(await service.findPending(user_code)).toBeUndefined()
    expect(await service.approve(user_code, 'valid-jwt')).toBe(false)
  })
})
