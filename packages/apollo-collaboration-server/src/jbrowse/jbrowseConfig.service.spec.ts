import fs from 'node:fs/promises'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'

import { BgzipIndexedFasta } from '@gmod/indexedfasta'
import { jest } from '@jest/globals'
import type { ConfigService } from '@nestjs/config'

import type { JBrowseSequenceConfig } from './jbrowseConfig.service.js'

// `resolveJBrowseDir` anchors itself off `import.meta.dirname`, which Jest's
// experimental VM-modules ESM loader doesn't populate. Mock it here with an
// identity function so tests can pass an already-absolute temp directory as
// JBROWSE_DIR, the same pattern used in index-html.controller.spec.ts.
jest.unstable_mockModule('../utils/jbrowse-dir.util.js', () => ({
  resolveJBrowseDir: (jbrowseDir: string) => jbrowseDir,
}))

const { JBrowseConfigService } = await import('./jbrowseConfig.service.js')

interface Env {
  JBROWSE_DIR?: string
  JBROWSE_DEV_SERVER_URL?: string
  JBROWSE_CONFIG_FILES?: string
}

function makeConfigService(values: Env) {
  return {
    get: (key: string) => values[key as keyof Env],
  } as unknown as ConfigService<Env, true>
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

const sequenceConfigFor = (assemblyName: string) => ({
  adapter: {
    type: 'BgzipFastaAdapter',
    fastaLocation: { uri: `${assemblyName}.fa.gz` },
    faiLocation: { uri: `${assemblyName}.fa.gz.fai` },
    gziLocation: { uri: `${assemblyName}.fa.gz.gzi` },
  },
})

describe('JBrowseConfigService.getConfigFileNames', () => {
  it('defaults to config.json when unset', () => {
    const service = new JBrowseConfigService(makeConfigService({}))
    expect(service.getConfigFileNames()).toEqual(['config.json'])
  })

  it('parses a comma-separated list, trimming whitespace and dropping empty entries', () => {
    const service = new JBrowseConfigService(
      makeConfigService({
        JBROWSE_CONFIG_FILES: ' config.json, config_mouse.json ,,',
      }),
    )
    expect(service.getConfigFileNames()).toEqual([
      'config.json',
      'config_mouse.json',
    ])
  })
})

describe('JBrowseConfigService.getDefaultConfigFileName', () => {
  it('returns the first configured entry', () => {
    const service = new JBrowseConfigService(
      makeConfigService({
        JBROWSE_CONFIG_FILES: 'config.json,config_mouse.json',
      }),
    )
    expect(service.getDefaultConfigFileName()).toBe('config.json')
  })

  it('returns "config.json" when JBROWSE_CONFIG_FILES is unset', () => {
    const service = new JBrowseConfigService(makeConfigService({}))
    expect(service.getDefaultConfigFileName()).toBe('config.json')
  })
})

describe('JBrowseConfigService.matchConfigFileName', () => {
  const service = new JBrowseConfigService(
    makeConfigService({
      JBROWSE_CONFIG_FILES: 'config.json,test_data/config_mouse.json',
    }),
  )

  it('matches a top-level configured file, with or without a leading slash', () => {
    expect(service.matchConfigFileName('config.json')).toBe('config.json')
    expect(service.matchConfigFileName('/config.json')).toBe('config.json')
  })

  it('matches a nested configured file', () => {
    expect(service.matchConfigFileName('/test_data/config_mouse.json')).toBe(
      'test_data/config_mouse.json',
    )
  })

  it('decodes percent-encoding before matching', () => {
    expect(service.matchConfigFileName('/test%5Fdata/config_mouse.json')).toBe(
      'test_data/config_mouse.json',
    )
  })

  it('returns undefined for a path not on the allowlist, never falling back to the default', () => {
    expect(service.matchConfigFileName('/config_other.json')).toBeUndefined()
    expect(service.matchConfigFileName('/../../etc/passwd')).toBeUndefined()
    expect(
      service.matchConfigFileName('/http://evil.example.com/config.json'),
    ).toBeUndefined()
  })

  it('returns undefined for malformed percent-encoding rather than throwing', () => {
    expect(service.matchConfigFileName('/%E0%A4%A')).toBeUndefined()
  })
})

describe('JBrowseConfigService.readJBrowseFileConfig (disk mode)', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jbrowse-config-'))
    await fs.writeFile(
      path.join(tmpDir, 'config.json'),
      JSON.stringify({ assemblies: [{ name: 'default-assembly' }] }),
    )
    await fs.writeFile(
      path.join(tmpDir, 'config_mouse.json'),
      JSON.stringify({ assemblies: [{ name: 'mouse-assembly' }] }),
    )
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('reads the default file when no filename is given', async () => {
    const service = new JBrowseConfigService(
      makeConfigService({ JBROWSE_DIR: tmpDir }),
    )
    const config = await service.readJBrowseFileConfig()
    expect(config.assemblies?.[0]?.name).toBe('default-assembly')
  })

  it('reads a specific configured filename', async () => {
    const service = new JBrowseConfigService(
      makeConfigService({ JBROWSE_DIR: tmpDir }),
    )
    const config = await service.readJBrowseFileConfig('config_mouse.json')
    expect(config.assemblies?.[0]?.name).toBe('mouse-assembly')
  })
})

describe('JBrowseConfigService.readJBrowseFileConfig (dev-server mode)', () => {
  it('fetches the named file from the dev server', async () => {
    const server = http.createServer((request, response) => {
      if (request.url === '/config_mouse.json') {
        response.writeHead(200, { 'Content-Type': 'application/json' })
        response.end(
          JSON.stringify({ assemblies: [{ name: 'mouse-assembly' }] }),
        )
        return
      }
      response.writeHead(404)
      response.end()
    })
    const devServerUrl = await listen(server)
    try {
      const service = new JBrowseConfigService(
        makeConfigService({ JBROWSE_DEV_SERVER_URL: devServerUrl }),
      )
      const config = await service.readJBrowseFileConfig('config_mouse.json')
      expect(config.assemblies?.[0]?.name).toBe('mouse-assembly')
    } finally {
      await close(server)
    }
  })

  it('includes the requested filename in the error on a non-2xx response', async () => {
    const server = http.createServer((_request, response) => {
      response.writeHead(404)
      response.end()
    })
    const devServerUrl = await listen(server)
    try {
      const service = new JBrowseConfigService(
        makeConfigService({ JBROWSE_DEV_SERVER_URL: devServerUrl }),
      )
      await expect(
        service.readJBrowseFileConfig('config_mouse.json'),
      ).rejects.toThrow('config_mouse.json')
    } finally {
      await close(server)
    }
  })
})

describe('JBrowseConfigService.readAllJBrowseFileConfigs', () => {
  it('reads every configured file, keyed by filename, in declared order', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jbrowse-config-'))
    try {
      await fs.writeFile(
        path.join(tmpDir, 'config.json'),
        JSON.stringify({ assemblies: [{ name: 'default-assembly' }] }),
      )
      await fs.writeFile(
        path.join(tmpDir, 'config_mouse.json'),
        JSON.stringify({ assemblies: [{ name: 'mouse-assembly' }] }),
      )
      const service = new JBrowseConfigService(
        makeConfigService({
          JBROWSE_DIR: tmpDir,
          JBROWSE_CONFIG_FILES: 'config.json,config_mouse.json',
        }),
      )
      const configs = await service.readAllJBrowseFileConfigs()
      expect([...configs.keys()]).toEqual(['config.json', 'config_mouse.json'])
      expect(configs.get('config_mouse.json')?.assemblies?.[0]?.name).toBe(
        'mouse-assembly',
      )
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true })
    }
  })
})

describe('JBrowseConfigService.getSequenceAdapterForAssembly', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jbrowse-config-'))
    await fs.writeFile(
      path.join(tmpDir, 'config.json'),
      JSON.stringify({
        assemblies: [
          { name: 'default-assembly', sequence: sequenceConfigFor('default') },
        ],
      }),
    )
    await fs.writeFile(
      path.join(tmpDir, 'config_mouse.json'),
      JSON.stringify({
        assemblies: [
          { name: 'mouse-assembly', sequence: sequenceConfigFor('mouse') },
        ],
      }),
    )
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('finds an assembly that only exists in a non-default configured file', async () => {
    const service = new JBrowseConfigService(
      makeConfigService({
        JBROWSE_DIR: tmpDir,
        JBROWSE_CONFIG_FILES: 'config.json,config_mouse.json',
      }),
    )
    const adapter = await service.getSequenceAdapterForAssembly(
      'mouse-assembly',
      'config_mouse.json',
    )
    expect(adapter).toBeInstanceOf(BgzipIndexedFasta)
  })

  it('throws when the assembly is not found in the given config file, even if it exists in another one', async () => {
    const service = new JBrowseConfigService(
      makeConfigService({
        JBROWSE_DIR: tmpDir,
        JBROWSE_CONFIG_FILES: 'config.json,config_mouse.json',
      }),
    )
    await expect(
      service.getSequenceAdapterForAssembly('mouse-assembly', 'config.json'),
    ).rejects.toThrow(
      'Assembly "mouse-assembly" not found in configured config.json file "config.json"',
    )
  })

  it('throws when not found in the given config file at all', async () => {
    const service = new JBrowseConfigService(
      makeConfigService({
        JBROWSE_DIR: tmpDir,
        JBROWSE_CONFIG_FILES: 'config.json,config_mouse.json',
      }),
    )
    await expect(
      service.getSequenceAdapterForAssembly('missing-assembly', 'config.json'),
    ).rejects.toThrow(
      'Assembly "missing-assembly" not found in configured config.json file "config.json"',
    )
  })

  it('resolves the correct, distinct sequence data when two config files define an assembly with the same name', async () => {
    await fs.writeFile(
      path.join(tmpDir, 'config.json'),
      JSON.stringify({
        assemblies: [
          {
            name: 'shared-assembly',
            sequence: {
              adapter: {
                type: 'FromConfigSequenceAdapter',
                features: [{ refName: 'chr1', start: 0, end: 4, seq: 'AAAA' }],
              },
            },
          },
        ],
      }),
    )
    await fs.writeFile(
      path.join(tmpDir, 'config_other.json'),
      JSON.stringify({
        assemblies: [
          {
            name: 'shared-assembly',
            sequence: {
              adapter: {
                type: 'FromConfigSequenceAdapter',
                features: [{ refName: 'chr1', start: 0, end: 4, seq: 'CCCC' }],
              },
            },
          },
        ],
      }),
    )
    const service = new JBrowseConfigService(
      makeConfigService({
        JBROWSE_DIR: tmpDir,
        JBROWSE_CONFIG_FILES: 'config.json,config_other.json',
      }),
    )

    const fromConfig = await service.getSequenceAdapterForAssembly(
      'shared-assembly',
      'config.json',
    )
    const fromOther = await service.getSequenceAdapterForAssembly(
      'shared-assembly',
      'config_other.json',
    )

    await expect(fromConfig.getSequence('chr1', 0, 4)).resolves.toBe('AAAA')
    await expect(fromOther.getSequence('chr1', 0, 4)).resolves.toBe('CCCC')
  })
})

describe('JBrowseConfigService.buildSequenceAdapter', () => {
  const testDataDir = path.join(process.cwd(), 'test/data')
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jbrowse-config-'))
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  async function copyFixture(name: string): Promise<void> {
    await fs.copyFile(path.join(testDataDir, name), path.join(tmpDir, name))
  }

  it('reads a BgzipFastaAdapter via a local (non-http) uri, resolved against JBROWSE_DIR', async () => {
    await Promise.all(
      ['volvox.fa.gz', 'volvox.fa.gz.fai', 'volvox.fa.gz.gzi'].map((name) =>
        copyFixture(name),
      ),
    )
    const service = new JBrowseConfigService(
      makeConfigService({ JBROWSE_DIR: tmpDir }),
    )
    const adapter = service.buildSequenceAdapter(
      'test',
      sequenceConfigFor('volvox'),
    )
    await expect(adapter.getSequence('ctgA', 0, 10)).resolves.toBe('cattgttgcg')
  })

  it('supports IndexedFastaAdapter', async () => {
    await Promise.all(
      ['volvox.fa', 'volvox.fa.fai'].map((name) => copyFixture(name)),
    )
    const service = new JBrowseConfigService(
      makeConfigService({ JBROWSE_DIR: tmpDir }),
    )
    const adapter = service.buildSequenceAdapter('test', {
      adapter: {
        type: 'IndexedFastaAdapter',
        fastaLocation: { uri: 'volvox.fa' },
        faiLocation: { uri: 'volvox.fa.fai' },
      },
    })
    await expect(adapter.getSequence('ctgA', 0, 10)).resolves.toBe('cattgttgcg')
    await expect(adapter.getSequenceSizes()).resolves.toEqual({
      ctgA: 50_001,
      ctgB: 6079,
    })
  })

  it('supports TwoBitAdapter', async () => {
    await copyFixture('volvox.2bit')
    const service = new JBrowseConfigService(
      makeConfigService({ JBROWSE_DIR: tmpDir }),
    )
    const adapter = service.buildSequenceAdapter('test', {
      adapter: {
        type: 'TwoBitAdapter',
        twoBitLocation: { uri: 'volvox.2bit' },
      },
    })
    await expect(adapter.getSequence('ctgA', 0, 10)).resolves.toBe('cattgttgcg')
    await expect(adapter.getSequenceSizes()).resolves.toEqual({
      ctgA: 50_001,
      ctgB: 6079,
    })
  })

  it('supports UnindexedFastaAdapter, and returns undefined for a missing refName', async () => {
    await copyFixture('tiny.fasta')
    const service = new JBrowseConfigService(
      makeConfigService({ JBROWSE_DIR: tmpDir }),
    )
    const adapter = service.buildSequenceAdapter('test', {
      adapter: {
        type: 'UnindexedFastaAdapter',
        fastaLocation: { uri: 'tiny.fasta' },
      },
    })
    await expect(adapter.getSequence('ctgA', 0, 10)).resolves.toBe('cattgttgcg')
    await expect(
      adapter.getSequence('missing-contig', 0, 10),
    ).resolves.toBeUndefined()
  })

  it('supports FromConfigSequenceAdapter, slicing and sizing inlined features', async () => {
    const service = new JBrowseConfigService(
      makeConfigService({ JBROWSE_DIR: tmpDir }),
    )
    const adapter = service.buildSequenceAdapter('test', {
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [{ refName: 'ctgA', start: 0, end: 4, seq: 'ACGT' }],
      },
    })
    await expect(adapter.getSequence('ctgA', 1, 3)).resolves.toBe('CG')
    await expect(
      adapter.getSequence('missing-contig', 0, 4),
    ).resolves.toBeUndefined()
    await expect(adapter.getSequenceSizes()).resolves.toEqual({ ctgA: 4 })
  })

  it('throws for an unsupported adapter type', () => {
    const service = new JBrowseConfigService(
      makeConfigService({ JBROWSE_DIR: tmpDir }),
    )
    const sequence = {
      adapter: { type: 'ChromSizesAdapter' },
    } as unknown as JBrowseSequenceConfig
    expect(() => service.buildSequenceAdapter('test', sequence)).toThrow(
      'Unsupported sequence adapter type "ChromSizesAdapter" for assembly "test" in config.json',
    )
  })

  it('resolves a relative uri against the directory of the given config file, not JBROWSE_DIR itself', async () => {
    await fs.mkdir(path.join(tmpDir, 'subdir'), { recursive: true })
    await fs.copyFile(
      path.join(testDataDir, 'tiny.fasta'),
      path.join(tmpDir, 'subdir', 'tiny.fasta'),
    )
    const service = new JBrowseConfigService(
      makeConfigService({ JBROWSE_DIR: tmpDir }),
    )
    const adapter = service.buildSequenceAdapter(
      'test',
      {
        adapter: {
          type: 'UnindexedFastaAdapter',
          fastaLocation: { uri: 'tiny.fasta' },
        },
      },
      'subdir/config.json',
    )
    await expect(adapter.getSequence('ctgA', 0, 10)).resolves.toBe('cattgttgcg')
  })
})

describe('JBrowseConfigService.buildSequenceAdapter (dev-server mode)', () => {
  it('resolves a relative uri against the directory of the given config file on the dev server', async () => {
    const server = http.createServer((request, response) => {
      if (request.url === '/subdir/tiny.fasta') {
        response.writeHead(200, { 'Content-Type': 'text/plain' })
        response.end('>ctgA\nACGT\n')
        return
      }
      response.writeHead(404)
      response.end()
    })
    const devServerUrl = await listen(server)
    try {
      const service = new JBrowseConfigService(
        makeConfigService({ JBROWSE_DEV_SERVER_URL: devServerUrl }),
      )
      const adapter = service.buildSequenceAdapter(
        'test',
        {
          adapter: {
            type: 'UnindexedFastaAdapter',
            fastaLocation: { uri: 'tiny.fasta' },
          },
        },
        'subdir/config.json',
      )
      await expect(adapter.getSequence('ctgA', 0, 4)).resolves.toBe('ACGT')
    } finally {
      await close(server)
    }
  })
})
