import type { PluginRoute } from '@apollo-annotation/common/server'
import { jest } from '@jest/globals'
import type { Request, Response } from 'express'

import type { AssemblyAccessService } from '../assemblyAccess/assemblyAccess.service.js'

import { PluginRoutesController } from './pluginRoutes.controller.js'
import type { PluginsService } from './plugins.service.js'

function makeController(route?: PluginRoute) {
  const pluginsService = {
    findRoute: () => (route ? { route, params: { id: '1' } } : undefined),
  } as unknown as PluginsService
  const assemblyAccessService = {
    getAllowedAssemblyIds: () => Promise.resolve(['assembly1']),
  } as unknown as AssemblyAccessService
  const connection = { id: 'connection' }
  return new PluginRoutesController(
    pluginsService,
    assemblyAccessService,
    connection as never,
  )
}

function makeRequest(user?: Record<string, unknown>) {
  return {
    path: '/plugin-routes/my-plugin/widgets/1',
    method: 'GET',
    user,
  } as unknown as Request
}

function makeResponse() {
  const res = {
    headersSent: false,
    status: jest.fn(() => res),
    end: jest.fn(),
  }
  return res
}

const user = {
  id: 'userId',
  username: 'User',
  email: 'user@example.com',
  role: 'readOnly',
}

describe('PluginRoutesController', () => {
  it('responds 404 when no route matches', async () => {
    const res = makeResponse()
    await makeController().handle(makeRequest(user), res as unknown as Response)
    expect(res.status).toHaveBeenCalledWith(404)
  })

  it('calls the handler with params, user and assembly access', async () => {
    const handler = jest.fn<PluginRoute['handler']>()
    const route: PluginRoute = { method: 'GET', path: '/x/:id', handler }
    const req = makeRequest(user)
    const res = makeResponse()

    await makeController(route).handle(req, res as unknown as Response)

    expect(handler).toHaveBeenCalledWith(
      req,
      res,
      expect.objectContaining({
        params: { id: '1' },
        user,
        allowedAssemblyIds: ['assembly1'],
        connection: { id: 'connection' },
      }),
    )
  })

  it("responds 403 when the user doesn't have the route's role", async () => {
    const handler = jest.fn<PluginRoute['handler']>()
    const route: PluginRoute = {
      method: 'GET',
      path: '/x/:id',
      role: 'admin',
      handler,
    }
    const res = makeResponse()

    await makeController(route).handle(
      makeRequest(user),
      res as unknown as Response,
    )

    expect(res.status).toHaveBeenCalledWith(403)
    expect(handler).not.toHaveBeenCalled()
  })

  it('requires the read-only role by default', async () => {
    const handler = jest.fn<PluginRoute['handler']>()
    const res = makeResponse()

    await makeController({ method: 'GET', path: '/x', handler }).handle(
      makeRequest({ role: 'none' }),
      res as unknown as Response,
    )

    expect(res.status).toHaveBeenCalledWith(403)
    expect(handler).not.toHaveBeenCalled()
  })

  it("lets anyone use a route with role 'none'", async () => {
    const handler = jest.fn<PluginRoute['handler']>()

    await makeController({
      method: 'GET',
      path: '/x',
      role: 'none',
      handler,
    }).handle(
      makeRequest({ role: 'none' }),
      makeResponse() as unknown as Response,
    )

    expect(handler).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ user: undefined }),
    )
  })

  it('responds 500 when the handler throws', async () => {
    const res = makeResponse()
    await makeController({
      method: 'GET',
      path: '/x',
      handler: () => {
        throw new Error('boom')
      },
    }).handle(makeRequest(user), res as unknown as Response)
    expect(res.status).toHaveBeenCalledWith(500)
  })
})
