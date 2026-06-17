// Minimal static file server for serving the dev build on :9000 with CORS.
//
// Replaces `serve --cors`: that tool forwards every request, including
// OPTIONS preflights, to its static file handler, so a preflight gets the
// full file body instead of an empty response. Browsers don't drain a
// preflight body before reusing the keep-alive connection for the real
// request, so the leftover bytes corrupt the next response on that
// connection -- this is what caused jbrowse's worker-side importScripts()
// to fail (and occasional ERR_BLOCKED_BY_ORB on the main thread) while the
// same URL loaded fine standalone. See https://github.com/vercel/serve.

import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve } from 'node:path'

const PORT = 9000
const ROOT = process.cwd()

const contentTypes = {
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
}

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', '*')
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Private-Network', 'true')
}

const server = createServer((req, res) => {
  setCorsHeaders(res)

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405)
    res.end()
    return
  }

  const requestPath = normalize(decodeURIComponent(req.url.split('?')[0]))
  const filePath = resolve(join(ROOT, requestPath))
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403)
    res.end()
    return
  }

  stat(filePath)
    .then((stats) => {
      if (!stats.isFile()) {
        res.writeHead(404)
        res.end()
        return
      }
      const etag = `"${createHash('sha1')
        .update(`${filePath}-${stats.mtimeMs}-${stats.size}`)
        .digest('hex')}"`
      res.setHeader('ETag', etag)
      res.setHeader('Content-Length', stats.size)
      res.setHeader(
        'Content-Type',
        contentTypes[extname(filePath)] ?? 'application/octet-stream',
      )

      if (req.headers['if-none-match'] === etag) {
        res.writeHead(304)
        res.end()
        return
      }

      res.writeHead(200)
      if (req.method === 'HEAD') {
        res.end()
        return
      }
      createReadStream(filePath).pipe(res)
    })
    .catch(() => {
      res.writeHead(404)
      res.end()
    })
})

server.listen(PORT, () => {
  console.log(`Serving ${ROOT} at http://localhost:${PORT}`)
})
