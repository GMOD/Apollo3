import http from 'node:http'
import path from 'node:path'

import { jest } from '@jest/globals'
import { NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Test, type TestingModule } from '@nestjs/testing'

// `resolveJBrowseDir` anchors itself off `import.meta.dirname`, which Jest's
// experimental VM-modules ESM loader doesn't populate. Mock it here with an
// equivalent resolution based on `process.cwd()` (the package root when
// running `yarn test`) so the rest of the controller can be exercised
// end-to-end against the real `assets/index.html` fixture.
jest.unstable_mockModule('../utils/jbrowse-dir.util.js', () => ({
  resolveJBrowseDir: (jbrowseDir: string) =>
    path.resolve(process.cwd(), jbrowseDir),
}))

const { IndexHtmlController } = await import('./index-html.controller.js')
const { JBrowseService } = await import('../jbrowse/jbrowse.service.js')

function makeConfigService(values: Record<string, string>) {
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService<
    { JBROWSE_DIR?: string; JBROWSE_DEV_SERVER_URL?: string; URL: string },
    true
  >
}

function listen(server: http.Server): Promise<string> {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        throw new Error('Expected an AddressInfo')
      }
      resolve(`http://127.0.0.1:${address.port}`)
    })
  })
}

function close(server: http.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    })
  })
}

async function createController(
  values: Record<string, string>,
  jbrowseService?: { getConfig: (...args: unknown[]) => unknown },
) {
  const module: TestingModule = await Test.createTestingModule({
    controllers: [IndexHtmlController],
    providers: [
      { provide: ConfigService, useValue: makeConfigService(values) },
      {
        provide: JBrowseService,
        useValue: jbrowseService ?? { getConfig: () => ({}) },
      },
    ],
  }).compile()
  return module.get<InstanceType<typeof IndexHtmlController>>(
    IndexHtmlController,
  )
}

describe('IndexHtmlController', () => {
  it('should be defined', async () => {
    const controller = await createController({
      JBROWSE_DIR: './assets',
      URL: 'http://localhost:3999',
    })
    expect(controller).toBeDefined()
  })

  it('reads the real index.html and injects the auth redirect script', async () => {
    const controller = await createController({
      JBROWSE_DIR: './assets',
      URL: 'http://localhost:3999',
    })
    const html = await controller.getIndex()
    expect(html).toContain('<script>')
    expect(html).toContain(JSON.stringify('/'))
    expect(html).toContain('__apolloAuthRedirectInstalled')
  })

  it('derives the api prefix from a path-prefixed URL', async () => {
    const controller = await createController({
      JBROWSE_DIR: './assets',
      URL: 'https://example.com/apollo/',
    })
    const html = await controller.getIndex()
    expect(html).toContain(JSON.stringify('/apollo/'))
  })

  it('throws NotFoundException when index.html does not exist', async () => {
    const controller = await createController({
      JBROWSE_DIR: './this-directory-does-not-exist',
      URL: 'http://localhost:3999',
    })
    await expect(controller.getIndex()).rejects.toBeInstanceOf(
      NotFoundException,
    )
  })

  it('config.json delegates to JBrowseService.getConfig with the request role', async () => {
    const getConfig = jest.fn().mockReturnValue({ assemblies: [] })
    const controller = await createController(
      { JBROWSE_DIR: './assets', URL: 'http://localhost:3999' },
      { getConfig },
    )
    const request = { user: { role: 'admin', id: 'user-1' } }
    const result = await controller.getConfigJson(
      request as unknown as Parameters<typeof controller.getConfigJson>[0],
    )
    expect(getConfig).toHaveBeenCalledWith('admin')
    expect(result).toEqual({ assemblies: [] })
  })

  it('config.json passes undefined role for a user with no id', async () => {
    const getConfig = jest.fn().mockReturnValue({ assemblies: [] })
    const controller = await createController(
      { JBROWSE_DIR: './assets', URL: 'http://localhost:3999' },
      { getConfig },
    )
    const request = { user: { role: 'none' } }
    await controller.getConfigJson(
      request as unknown as Parameters<typeof controller.getConfigJson>[0],
    )
    expect(getConfig).toHaveBeenCalledWith(undefined)
  })

  it('config.json throws when there is no user on the request', async () => {
    const controller = await createController({
      JBROWSE_DIR: './assets',
      URL: 'http://localhost:3999',
    })
    const request = { user: undefined }
    expect(() =>
      controller.getConfigJson(
        request as unknown as Parameters<typeof controller.getConfigJson>[0],
      ),
    ).toThrow('No user for request')
  })

  describe('dev-server mode (JBROWSE_DEV_SERVER_URL)', () => {
    it('fetches index.html from the dev server and injects the script', async () => {
      const server = http.createServer((request, response) => {
        if (request.url === '/index.html') {
          response.writeHead(200, { 'Content-Type': 'text/html' })
          response.end(
            '<!doctype html><html><head><title>dev</title></head><body>dev server</body></html>',
          )
          return
        }
        response.writeHead(404)
        response.end()
      })
      const devServerUrl = await listen(server)
      try {
        const controller = await createController({
          JBROWSE_DEV_SERVER_URL: devServerUrl,
          URL: 'http://localhost:3999',
        })
        const html = await controller.getIndex()
        expect(html).toContain('dev server')
        expect(html).toContain('__apolloAuthRedirectInstalled')
      } finally {
        await close(server)
      }
    })

    it('throws NotFoundException when the dev server responds with a non-2xx status', async () => {
      const server = http.createServer((_request, response) => {
        response.writeHead(404)
        response.end()
      })
      const devServerUrl = await listen(server)
      try {
        const controller = await createController({
          JBROWSE_DEV_SERVER_URL: devServerUrl,
          URL: 'http://localhost:3999',
        })
        await expect(controller.getIndex()).rejects.toBeInstanceOf(
          NotFoundException,
        )
      } finally {
        await close(server)
      }
    })

    it('throws NotFoundException when the dev server is unreachable', async () => {
      const server = http.createServer()
      const devServerUrl = await listen(server)
      await close(server) // nothing listening on this port now

      const controller = await createController({
        JBROWSE_DEV_SERVER_URL: devServerUrl,
        URL: 'http://localhost:3999',
      })
      await expect(controller.getIndex()).rejects.toBeInstanceOf(
        NotFoundException,
      )
    })
  })
})
