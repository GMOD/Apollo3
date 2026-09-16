import { Check } from '@apollo-annotation/schemas'
import { jest } from '@jest/globals'
import { Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { getModelToken } from '@nestjs/mongoose'
import { Test, type TestingModule } from '@nestjs/testing'

import { AssembliesService } from '../assemblies/assemblies.service.js'
import { RefSeqsService } from '../refSeqs/refSeqs.service.js'
import { Role } from '../utils/role/role.enum.js'

import type { JBrowseFileConfig } from './jbrowseConfig.service.js'
import { JBrowseConfigService } from './jbrowseConfig.service.js'
import { JBrowseService } from './jbrowse.service.js'

describe('JBrowseService', () => {
  let service: JBrowseService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JBrowseService,
        { provide: AssembliesService, useValue: {} },
        { provide: RefSeqsService, useValue: {} },
        { provide: JBrowseConfigService, useValue: {} },
        { provide: getModelToken(Check.name), useValue: {} },
        { provide: ConfigService, useValue: {} },
      ],
    }).compile()

    service = module.get<JBrowseService>(JBrowseService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})

interface StoredAssembly {
  id: string
  name: string
  _id: { toHexString: () => string }
}

function makeAssembly(name: string, id = name): StoredAssembly {
  return { id, name, _id: { toHexString: () => id } }
}

async function createService(overrides: {
  jbrowseConfigService?: Record<string, unknown>
  assembliesService?: Record<string, unknown>
  refSeqsService?: Record<string, unknown>
  checkModel?: Record<string, unknown>
  configService?: Record<string, unknown>
}) {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      JBrowseService,
      {
        provide: AssembliesService,
        useValue: overrides.assembliesService ?? {},
      },
      { provide: RefSeqsService, useValue: overrides.refSeqsService ?? {} },
      {
        provide: JBrowseConfigService,
        useValue: overrides.jbrowseConfigService ?? {},
      },
      {
        provide: getModelToken(Check.name),
        useValue: overrides.checkModel ?? {},
      },
      { provide: ConfigService, useValue: overrides.configService ?? {} },
    ],
  }).compile()
  return module.get<JBrowseService>(JBrowseService)
}

describe('JBrowseService.onApplicationBootstrap', () => {
  it('seeds assemblies from every configured config.json file', async () => {
    // A bare `jest.fn()` already resolves to `undefined` when awaited, so
    // there's no assembly with this name yet as far as Mongo is concerned.
    const findByName = jest.fn<(name: string) => undefined>()
    const create = jest
      .fn<(input: { name: string }) => Promise<StoredAssembly>>()
      .mockImplementation(({ name }) => Promise.resolve(makeAssembly(name)))
    const findAll = jest.fn<() => Promise<StoredAssembly[]>>()
    findAll.mockResolvedValue([])
    const checkModel = { find: () => ({ exec: () => Promise.resolve([]) }) }
    const sequenceAdapter = {
      getSequenceSizes: () => Promise.resolve({ chr1: 100 }),
    }
    const readAllJBrowseFileConfigs =
      jest.fn<() => Promise<Map<string, JBrowseFileConfig>>>()
    readAllJBrowseFileConfigs.mockResolvedValue(
      new Map([
        ['config.json', { assemblies: [{ name: 'default-assembly' }] }],
        ['config_mouse.json', { assemblies: [{ name: 'mouse-assembly' }] }],
      ]) as Map<string, JBrowseFileConfig>,
    )
    const buildSequenceAdapter = jest.fn<() => typeof sequenceAdapter>()
    buildSequenceAdapter.mockReturnValue(sequenceAdapter)
    const refSeqsCreate =
      jest.fn<(input: { name: string }) => Promise<{ id: string }>>()
    refSeqsCreate.mockResolvedValue({ id: 'refseq-1' })

    const service = await createService({
      jbrowseConfigService: { readAllJBrowseFileConfigs, buildSequenceAdapter },
      assembliesService: { findByName, create, findAll },
      refSeqsService: { create: refSeqsCreate },
      checkModel,
    })

    await service.onApplicationBootstrap()

    expect(create).toHaveBeenCalledTimes(2)
    expect(create.mock.calls.map((call) => call[0].name)).toEqual([
      'default-assembly',
      'mouse-assembly',
    ])
  })

  it('does not re-add an assembly name that already exists in Mongo', async () => {
    const findByName =
      jest.fn<(name: string) => Promise<{ name: string } | undefined>>()
    findByName.mockImplementation((name) =>
      Promise.resolve(name === 'default-assembly' ? { name } : undefined),
    )
    const create =
      jest.fn<(input: { name: string }) => Promise<StoredAssembly>>()
    const findAll = jest.fn<() => Promise<StoredAssembly[]>>()
    findAll.mockResolvedValue([])
    const readAllJBrowseFileConfigs =
      jest.fn<() => Promise<Map<string, JBrowseFileConfig>>>()
    readAllJBrowseFileConfigs.mockResolvedValue(
      new Map([
        ['config.json', { assemblies: [{ name: 'default-assembly' }] }],
        ['config_mouse.json', { assemblies: [{ name: 'default-assembly' }] }],
      ]) as Map<string, JBrowseFileConfig>,
    )

    const service = await createService({
      jbrowseConfigService: { readAllJBrowseFileConfigs },
      assembliesService: { findByName, create, findAll },
    })

    await service.onApplicationBootstrap()

    expect(create).not.toHaveBeenCalled()
  })

  it('warns about a stored assembly missing from every configured file, but not one present in a non-default file', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {
      /* suppress log output in the test run */
    })
    const findByName = jest.fn<(name: string) => Promise<{ name: string }>>()
    findByName.mockResolvedValue({ name: 'default-assembly' })
    const findAll = jest.fn<() => Promise<StoredAssembly[]>>()
    findAll.mockResolvedValue([
      makeAssembly('default-assembly'),
      makeAssembly('mouse-assembly'),
      makeAssembly('orphaned-assembly'),
    ])
    const readAllJBrowseFileConfigs =
      jest.fn<() => Promise<Map<string, JBrowseFileConfig>>>()
    readAllJBrowseFileConfigs.mockResolvedValue(
      new Map([
        ['config.json', { assemblies: [{ name: 'default-assembly' }] }],
        ['config_mouse.json', { assemblies: [{ name: 'mouse-assembly' }] }],
      ]) as Map<string, JBrowseFileConfig>,
    )

    const service = await createService({
      jbrowseConfigService: { readAllJBrowseFileConfigs },
      assembliesService: { findByName, create: jest.fn(), findAll },
    })

    await service.onApplicationBootstrap()

    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('orphaned-assembly'),
    )
    warn.mockRestore()
  })
})

describe('JBrowseService.getConfig / getTracks scoping', () => {
  it('scopes tracks to the selected config file and resolves configId through JBrowseConfigService', async () => {
    const resolveConfigFileName = jest.fn<(requested?: string) => string>()
    resolveConfigFileName.mockReturnValue('config_mouse.json')
    const readJBrowseFileConfig =
      jest.fn<(fileName?: string) => Promise<JBrowseFileConfig>>()
    readJBrowseFileConfig.mockResolvedValue({
      assemblies: [{ name: 'mouse-assembly' }],
    } as JBrowseFileConfig)
    const findAll = jest.fn<() => Promise<StoredAssembly[]>>()
    findAll.mockResolvedValue([
      makeAssembly('default-assembly'),
      makeAssembly('mouse-assembly'),
    ])

    const service = await createService({
      jbrowseConfigService: { resolveConfigFileName, readJBrowseFileConfig },
      assembliesService: { findAll },
      configService: {
        get: (key: string) =>
          key === 'URL' ? 'http://localhost:3999' : undefined,
      },
    })

    const result = await service.getConfig(
      { id: 'user-1', iat: 0, role: Role.Admin },
      'config_mouse.json',
    )

    expect(resolveConfigFileName).toHaveBeenCalledWith('config_mouse.json')
    expect(readJBrowseFileConfig).toHaveBeenCalledWith('config_mouse.json')
    const { tracks } = result as { tracks: { trackId: string }[] }
    expect(tracks).toHaveLength(1)
    expect(tracks[0]?.trackId).toBe('apollo_track_mouse-assembly')
  })

  it('produces the same output as before when no configId is given (single default file)', async () => {
    const resolveConfigFileName = jest.fn<(requested?: string) => string>()
    resolveConfigFileName.mockReturnValue('config.json')
    const readJBrowseFileConfig =
      jest.fn<(fileName?: string) => Promise<JBrowseFileConfig>>()
    readJBrowseFileConfig.mockResolvedValue({
      assemblies: [{ name: 'default-assembly' }],
    } as JBrowseFileConfig)
    const findAll = jest.fn<() => Promise<StoredAssembly[]>>()
    findAll.mockResolvedValue([makeAssembly('default-assembly')])

    const service = await createService({
      jbrowseConfigService: { resolveConfigFileName, readJBrowseFileConfig },
      assembliesService: { findAll },
      configService: {
        get: (key: string) =>
          key === 'URL' ? 'http://localhost:3999' : undefined,
      },
    })

    const result = await service.getConfig({
      id: 'user-1',
      iat: 0,
      role: Role.Admin,
    })

    const { tracks } = result as { tracks: { trackId: string }[] }
    expect(tracks).toHaveLength(1)
    expect(tracks[0]?.trackId).toBe('apollo_track_default-assembly')
  })
})
