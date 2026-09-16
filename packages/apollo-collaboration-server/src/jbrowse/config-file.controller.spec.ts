import { jest } from '@jest/globals'
import type { ConfigService } from '@nestjs/config'
import express, { type Request } from 'express'

import { Role } from '../utils/role/role.enum.js'

import { ConfigFileController } from './config-file.controller.js'
import { JBrowseConfigService } from './jbrowseConfig.service.js'
import type { JBrowseService } from './jbrowse.service.js'

interface RequestWithUser extends Request {
  user?: { role: Role; id?: string }
}

function makeConfigService(configFileNames: string[]) {
  return {
    get: (key: string) =>
      key === 'JBROWSE_CONFIG_FILES' ? configFileNames.join(',') : undefined,
  } as unknown as ConfigService<{ JBROWSE_CONFIG_FILES?: string }, true>
}

interface FetchResult {
  status: number
  body: unknown
  fellThrough: boolean
}

interface TestApp {
  getConfig: jest.Mock<(...args: unknown[]) => unknown>
  fetch: (
    path: string,
    user?: { role: Role; id?: string },
  ) => Promise<FetchResult>
}

function makeApp(configFileNames: string[]): TestApp {
  const getConfig = jest.fn<(...args: unknown[]) => unknown>()
  const jbrowseConfigService = new JBrowseConfigService(
    makeConfigService(configFileNames),
  )
  const controller = new ConfigFileController(jbrowseConfigService, {
    getConfig,
  } as unknown as JBrowseService)

  const app = express()
  app.use((request, _response, next) => {
    const requestWithUser = request as RequestWithUser
    const role = request.headers['x-role'] as string | undefined
    if (role) {
      requestWithUser.user = {
        role: role as Role,
        id: request.headers['x-id'] as string,
      }
    }
    next()
  })
  app.get('*path', (request, response, next) => {
    // Mimics just enough of Nest's real per-route exception filter (which
    // the production app gets for free) for a thrown error to become a real
    // HTTP response here too, instead of an unhandled rejection.
    controller
      .getConfigFile(request as RequestWithUser, response, next)
      .catch((error: unknown) => {
        const httpException =
          error && typeof error === 'object' && 'getStatus' in error
            ? (error as { getStatus: () => number })
            : undefined
        const status = httpException ? httpException.getStatus() : 500
        response
          .status(status)
          .json({ message: error instanceof Error ? error.message : error })
      })
  })
  app.use((_request, response) => {
    response.status(418).json({ fellThrough: true })
  })

  return {
    getConfig,
    async fetch(path, user) {
      const headers: Record<string, string> = {}
      if (user) {
        headers['x-role'] = user.role
        if (user.id) {
          headers['x-id'] = user.id
        }
      }
      const server = app.listen(0, '127.0.0.1')
      try {
        await new Promise<void>((resolve) => {
          server.once('listening', resolve)
        })
        const address = server.address()
        if (!address || typeof address === 'string') {
          throw new Error('Expected an AddressInfo')
        }
        const response = await fetch(
          `http://127.0.0.1:${address.port}${path}`,
          { headers },
        )
        return {
          status: response.status,
          body: await response.json(),
          fellThrough: response.status === 418,
        }
      } finally {
        server.close()
      }
    },
  }
}

describe('ConfigFileController', () => {
  it('serves the augmented config for a top-level configured file', async () => {
    const app = makeApp(['config.json'])
    app.getConfig.mockReturnValue({ plugins: ['Apollo'] })
    const result = await app.fetch('/config.json', {
      role: Role.Admin,
      id: 'user-1',
    })
    expect(result.status).toBe(200)
    expect(result.body).toEqual({ plugins: ['Apollo'] })
    expect(app.getConfig).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-1', role: Role.Admin }),
      'config.json',
    )
  })

  it('serves the augmented config for a nested, non-default configured file', async () => {
    const app = makeApp(['config.json', 'test_data/config.json'])
    app.getConfig.mockReturnValue({ plugins: ['Apollo'] })
    const result = await app.fetch('/test_data/config.json', {
      role: Role.Admin,
      id: 'user-1',
    })
    expect(result.status).toBe(200)
    expect(app.getConfig).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-1' }),
      'test_data/config.json',
    )
  })

  it('falls through to the next handler for an unmatched path', async () => {
    const app = makeApp(['config.json'])
    const result = await app.fetch('/static/js/bundle.js', {
      role: Role.Admin,
      id: 'user-1',
    })
    expect(result.fellThrough).toBe(true)
    expect(app.getConfig).not.toHaveBeenCalled()
  })

  it('falls through for a config-file-shaped path that was never declared', async () => {
    const app = makeApp(['test_data/config.json'])
    const result = await app.fetch('/config.json', {
      role: Role.Admin,
      id: 'user-1',
    })
    expect(result.fellThrough).toBe(true)
    expect(app.getConfig).not.toHaveBeenCalled()
  })

  it('falls through for a path-traversal-shaped request', async () => {
    const app = makeApp(['config.json'])
    const result = await app.fetch('/..%2f..%2fetc%2fpasswd', {
      role: Role.Admin,
      id: 'user-1',
    })
    expect(result.fellThrough).toBe(true)
    expect(app.getConfig).not.toHaveBeenCalled()
  })

  it('matches a percent-encoded configured path', async () => {
    const app = makeApp(['test_data/config.json'])
    app.getConfig.mockReturnValue({ plugins: ['Apollo'] })
    const result = await app.fetch('/test%5Fdata/config.json', {
      role: Role.Admin,
      id: 'user-1',
    })
    expect(result.status).toBe(200)
    expect(app.getConfig).toHaveBeenCalledWith(
      expect.anything(),
      'test_data/config.json',
    )
  })

  it('passes undefined as the user for an anonymous request', async () => {
    const app = makeApp(['config.json'])
    app.getConfig.mockReturnValue({ plugins: ['Apollo'] })
    await app.fetch('/config.json', { role: Role.None })
    expect(app.getConfig).toHaveBeenCalledWith(undefined, 'config.json')
  })

  it('produces a 404 when the matched config file cannot be read', async () => {
    const app = makeApp(['config.json'])
    app.getConfig.mockImplementation(() => Promise.reject(new Error('ENOENT')))
    const result = await app.fetch('/config.json', {
      role: Role.Admin,
      id: 'user-1',
    })
    expect(result.status).toBe(404)
  })

  it('throws when there is no user on the request', async () => {
    const app = makeApp(['config.json'])
    const result = await app.fetch('/config.json')
    expect(result.status).toBe(500)
    expect(app.getConfig).not.toHaveBeenCalled()
  })
})
