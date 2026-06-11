/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it } from '@jest/globals'

import { Role } from '../utils/role/role.enum.js'

import { AuthenticationService } from './authentication.service.js'

type AuthServiceCtorParams = ConstructorParameters<typeof AuthenticationService>

function makeService(config: Record<string, unknown>) {
  const configService = {
    get: (key: string) => config[key],
  } as AuthServiceCtorParams[2]

  return new AuthenticationService(
    {} as AuthServiceCtorParams[0],
    {} as AuthServiceCtorParams[1],
    configService,
  )
}

describe('AuthenticationService', () => {
  it('returns login types from direct client ID values', async () => {
    const service = makeService({
      DEFAULT_NEW_USER_ROLE: Role.None,
      MICROSOFT_CLIENT_ID: 'ms-direct',
      GOOGLE_CLIENT_ID: 'google-direct',
      LOGINGOV_CLIENT_ID: 'logingov-direct',
      ALLOW_GUEST_USER: true,
    })

    await expect(service.getLoginTypes()).resolves.toEqual([
      'microsoft',
      'google',
      'logingov',
      'guest',
    ])
  })

  it('returns login types when microsoft and google IDs are configured via files', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apollo-auth-'))
    const msClientIDPath = path.join(tempDir, 'microsoft-client-id')
    const googleClientIDPath = path.join(tempDir, 'google-client-id')
    const loginGovClientIDPath = path.join(tempDir, 'logingov-client-id')

    await fs.writeFile(msClientIDPath, ' ms-file-id \n')
    await fs.writeFile(googleClientIDPath, ' google-file-id \n')
    await fs.writeFile(loginGovClientIDPath, ' logingov-file-id \n')

    const service = makeService({
      DEFAULT_NEW_USER_ROLE: Role.None,
      MICROSOFT_CLIENT_ID_FILE: msClientIDPath,
      GOOGLE_CLIENT_ID_FILE: googleClientIDPath,
      LOGINGOV_CLIENT_ID_FILE: loginGovClientIDPath,
      ALLOW_GUEST_USER: false,
    })

    await expect(service.getLoginTypes()).resolves.toEqual([
      'microsoft',
      'google',
      'logingov',
    ])

    await fs.rm(tempDir, { recursive: true, force: true })
  })
})
