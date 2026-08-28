import http from 'node:http'

import type { ConfigService } from '@nestjs/config'
import express from 'express'

const { DevServerProxyController } = await import(
  './dev-server-proxy.controller.js'
)

function makeConfigService(devServerUrl: string) {
  return {
    get: () => devServerUrl,
  } as unknown as ConfigService<{ JBROWSE_DEV_SERVER_URL: string }, true>
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

describe('DevServerProxyController', () => {
  it('forwards a request to the configured JBrowse dev server', async () => {
    const devServer = http.createServer((request, response) => {
      if (request.url === '/static/js/bundle.js') {
        response.writeHead(200, { 'Content-Type': 'text/javascript' })
        response.end('console.log("bundle")')
        return
      }
      response.writeHead(404)
      response.end()
    })
    const devServerUrl = await listen(devServer)

    const controller = new DevServerProxyController(
      makeConfigService(devServerUrl),
    )
    const app = express()
    app.all('*splat', (request, response, next) => {
      controller.proxyToDevServer(request, response, next)
    })
    const proxyServer = http.createServer(app)
    const proxyUrl = await listen(proxyServer)

    try {
      const response = await fetch(`${proxyUrl}/static/js/bundle.js`)
      expect(response.status).toBe(200)
      expect(await response.text()).toBe('console.log("bundle")')
    } finally {
      await close(proxyServer)
      await close(devServer)
    }
  })

  it('forwards the dev server error status when the asset is missing', async () => {
    const devServer = http.createServer((_request, response) => {
      response.writeHead(404)
      response.end()
    })
    const devServerUrl = await listen(devServer)

    const controller = new DevServerProxyController(
      makeConfigService(devServerUrl),
    )
    const app = express()
    app.all('*splat', (request, response, next) => {
      controller.proxyToDevServer(request, response, next)
    })
    const proxyServer = http.createServer(app)
    const proxyUrl = await listen(proxyServer)

    try {
      const response = await fetch(`${proxyUrl}/static/js/missing.js`)
      expect(response.status).toBe(404)
    } finally {
      await close(proxyServer)
      await close(devServer)
    }
  })
})
