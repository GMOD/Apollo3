/* eslint-disable @typescript-eslint/no-floating-promises */
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const packageRoot = fileURLToPath(new URL('../../../..', import.meta.url))
const command = new URL('get.ts', import.meta.url).href

async function getFeatures(args: string[], responses: [object[], object[]][]) {
  const requests: URL[] = []
  const server = createServer((request, response) => {
    assert.equal(request.headers.authorization, 'Bearer test-token')
    const url = new URL(request.url ?? '', 'http://localhost')
    response.setHeader('Content-Type', 'application/json')
    switch (url.pathname) {
      case '/assemblies': {
        response.end(JSON.stringify([{ _id: 'assembly', name: 'test' }]))

        break
      }
      case '/refSeqs': {
        response.end(
          JSON.stringify(
            responses.map((_, index) => ({
              _id: `ref${index}`,
              name: `chr${index}`,
              assembly: 'assembly',
            })),
          ),
        )

        break
      }
      case '/features/getFeatures': {
        requests.push(url)
        response.end(
          JSON.stringify(
            responses[Number(url.searchParams.get('refSeq')?.slice(3))],
          ),
        )

        break
      }
      default: {
        response.writeHead(404).end()
      }
    }
  })
  const directory = await mkdtemp(path.join(tmpdir(), 'apollo-feature-get-'))
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  const configFile = path.join(directory, 'config.json')
  await writeFile(
    configFile,
    JSON.stringify({
      default: {
        address: `http://127.0.0.1:${address.port}`,
        accessType: 'guest',
        accessToken: 'test-token',
      },
    }),
  )
  try {
    const child = spawn(
      process.execPath,
      [
        '--import',
        'tsx',
        '--input-type=module',
        '--eval',
        `import Get from ${JSON.stringify(command)}; await Get.run(process.argv.slice(1), { root: ${JSON.stringify(packageRoot)} })`,
        '--',
        '--config-file',
        configFile,
        '-a',
        'test',
        ...args,
      ],
      { cwd: packageRoot, env: { ...process.env, APOLLO_PROFILE: 'default' } },
    )
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (data: Buffer) => {
      stdout += data.toString()
    })
    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString()
    })
    const code = await new Promise<number | null>((resolve) => {
      child.once('close', resolve)
    })
    assert.equal(code, 0, stderr)
    return { output: JSON.parse(stdout) as unknown, requests }
  } finally {
    server.closeAllConnections()
    await new Promise<void>((resolve, reject) =>
      server.close((error) => {
        if (error) {
          reject(error)
        } else {
          resolve()
        }
      }),
    )
    await rm(directory, { recursive: true, force: true })
  }
}

describe('feature get', () => {
  const features = [
    { _id: 'gene1', refSeq: 'ref0' },
    { _id: 'gene2', refSeq: 'ref1' },
  ]
  const checks = [
    { _id: 'check1', refSeq: 'ref0' },
    { _id: 'check2', refSeq: 'ref1' },
  ]

  it('keeps feature-only output by default across reference sequences', async () => {
    const { output } = await getFeatures(
      [],
      [
        [[features[0]], [checks[0]]],
        [[features[1]], [checks[1]]],
      ],
    )
    assert.deepEqual(output, features)
  })

  it('includes aggregated checks after the features when requested', async () => {
    const { output, requests } = await getFeatures(
      ['--include-checks', '-s', '10', '-e', '20'],
      [
        [[features[0]], [checks[0]]],
        [[features[1]], [checks[1]]],
      ],
    )
    assert.deepEqual(output, [features, checks])
    assert.deepEqual(
      requests.map((url) => Object.fromEntries(url.searchParams)),
      [
        { refSeq: 'ref0', start: '10', end: '20' },
        { refSeq: 'ref1', start: '10', end: '20' },
      ],
    )
  })

  it('preserves checks for a reference sequence with no returned features', async () => {
    const { output } = await getFeatures(
      ['--include-checks'],
      [[[], [checks[0]]]],
    )
    assert.deepEqual(output, [[], [checks[0]]])
  })

  it('returns two empty arrays when including checks for an empty assembly', async () => {
    const { output, requests } = await getFeatures(['--include-checks'], [])
    assert.deepEqual(output, [[], []])
    assert.equal(requests.length, 0)
  })
})
