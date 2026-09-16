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
  configId: string
  _id: { toHexString: () => string }
}

function makeAssembly(
  name: string,
  configId = 'config.json',
  id = name,
): StoredAssembly {
  return { id, name, configId, _id: { toHexString: () => id } }
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
    // there's no assembly with this (name, configId) pair yet as far as
    // Mongo is concerned.
    const findByNameAndConfig = jest.fn<(name: string) => undefined>()
    const create = jest
      .fn<
        (input: { name: string; configId: string }) => Promise<StoredAssembly>
      >()
      .mockImplementation(({ configId, name }) =>
        Promise.resolve(makeAssembly(name, configId)),
      )
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
      assembliesService: { findByNameAndConfig, create, findAll },
      refSeqsService: { create: refSeqsCreate },
      checkModel,
    })

    await service.onApplicationBootstrap()

    expect(create).toHaveBeenCalledTimes(2)
    expect(
      create.mock.calls.map((call) => [call[0].name, call[0].configId]),
    ).toEqual([
      ['default-assembly', 'config.json'],
      ['mouse-assembly', 'config_mouse.json'],
    ])
  })

  it('does not re-add an assembly for a config file it was already seeded from', async () => {
    const findByNameAndConfig =
      jest.fn<
        (
          name: string,
          configId: string,
        ) => Promise<{ name: string } | undefined>
      >()
    findByNameAndConfig.mockImplementation((name, configId) =>
      Promise.resolve(
        name === 'default-assembly' && configId === 'config.json'
          ? { name }
          : undefined,
      ),
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
      ]) as Map<string, JBrowseFileConfig>,
    )

    const service = await createService({
      jbrowseConfigService: { readAllJBrowseFileConfigs },
      assembliesService: { findByNameAndConfig, create, findAll },
    })

    await service.onApplicationBootstrap()

    expect(create).not.toHaveBeenCalled()
  })

  it('creates a separate assembly for each config file, even when the assembly names collide', async () => {
    const findByNameAndConfig = jest.fn<(name: string) => undefined>()
    const create = jest
      .fn<
        (input: { name: string; configId: string }) => Promise<StoredAssembly>
      >()
      .mockImplementation(({ configId, name }) =>
        Promise.resolve(makeAssembly(name, configId)),
      )
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
        ['config.json', { assemblies: [{ name: 'shared-assembly' }] }],
        ['config_other.json', { assemblies: [{ name: 'shared-assembly' }] }],
      ]) as Map<string, JBrowseFileConfig>,
    )
    const buildSequenceAdapter = jest.fn<() => typeof sequenceAdapter>()
    buildSequenceAdapter.mockReturnValue(sequenceAdapter)
    const refSeqsCreate =
      jest.fn<(input: { name: string }) => Promise<{ id: string }>>()
    refSeqsCreate.mockResolvedValue({ id: 'refseq-1' })

    const service = await createService({
      jbrowseConfigService: { readAllJBrowseFileConfigs, buildSequenceAdapter },
      assembliesService: { findByNameAndConfig, create, findAll },
      refSeqsService: { create: refSeqsCreate },
      checkModel,
    })

    await service.onApplicationBootstrap()

    expect(create).toHaveBeenCalledTimes(2)
    expect(
      create.mock.calls.map((call) => [call[0].name, call[0].configId]),
    ).toEqual([
      ['shared-assembly', 'config.json'],
      ['shared-assembly', 'config_other.json'],
    ])
  })

  it('warns about a stored assembly missing from every configured file, but not one present in a non-default file', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {
      /* suppress log output in the test run */
    })
    const findByNameAndConfig =
      jest.fn<(name: string) => Promise<{ name: string }>>()
    findByNameAndConfig.mockResolvedValue({ name: 'default-assembly' })
    const findAll = jest.fn<() => Promise<StoredAssembly[]>>()
    findAll.mockResolvedValue([
      makeAssembly('default-assembly', 'config.json'),
      makeAssembly('mouse-assembly', 'config_mouse.json'),
      makeAssembly('orphaned-assembly', 'config.json'),
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
      assembliesService: { findByNameAndConfig, create: jest.fn(), findAll },
    })

    await service.onApplicationBootstrap()

    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('orphaned-assembly'),
    )
    warn.mockRestore()
  })

  it('warns about an assembly stored under the wrong configId, even if the same name exists in the right file', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {
      /* suppress log output in the test run */
    })
    const findByNameAndConfig = jest.fn<(name: string) => undefined>()
    const create = jest
      .fn<
        (input: { name: string; configId: string }) => Promise<StoredAssembly>
      >()
      .mockImplementation(({ configId, name }) =>
        Promise.resolve(makeAssembly(name, configId)),
      )
    const findAll = jest.fn<() => Promise<StoredAssembly[]>>()
    findAll.mockResolvedValue([
      // Stored under "config_mouse.json" but the current configs only
      // define "shared-assembly" under "config.json" - this must still be
      // flagged as orphaned even though the bare name matches.
      makeAssembly('shared-assembly', 'config_mouse.json'),
    ])
    const checkModel = { find: () => ({ exec: () => Promise.resolve([]) }) }
    const sequenceAdapter = {
      getSequenceSizes: () => Promise.resolve({ chr1: 100 }),
    }
    const buildSequenceAdapter = jest.fn<() => typeof sequenceAdapter>()
    buildSequenceAdapter.mockReturnValue(sequenceAdapter)
    const refSeqsCreate =
      jest.fn<(input: { name: string }) => Promise<{ id: string }>>()
    refSeqsCreate.mockResolvedValue({ id: 'refseq-1' })
    const readAllJBrowseFileConfigs =
      jest.fn<() => Promise<Map<string, JBrowseFileConfig>>>()
    readAllJBrowseFileConfigs.mockResolvedValue(
      new Map([
        ['config.json', { assemblies: [{ name: 'shared-assembly' }] }],
      ]) as Map<string, JBrowseFileConfig>,
    )

    const service = await createService({
      jbrowseConfigService: { readAllJBrowseFileConfigs, buildSequenceAdapter },
      assembliesService: { findByNameAndConfig, create, findAll },
      refSeqsService: { create: refSeqsCreate },
      checkModel,
    })

    await service.onApplicationBootstrap()

    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('shared-assembly'),
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
      makeAssembly('default-assembly', 'config.json'),
      makeAssembly('mouse-assembly', 'config_mouse.json'),
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

  it('excludes an assembly from another config file even when its name matches', async () => {
    const resolveConfigFileName = jest.fn<(requested?: string) => string>()
    resolveConfigFileName.mockReturnValue('config.json')
    const readJBrowseFileConfig =
      jest.fn<(fileName?: string) => Promise<JBrowseFileConfig>>()
    readJBrowseFileConfig.mockResolvedValue({
      assemblies: [{ name: 'shared-assembly' }],
    } as JBrowseFileConfig)
    const findAll = jest.fn<() => Promise<StoredAssembly[]>>()
    findAll.mockResolvedValue([
      // Same name, but seeded from a different config file - must not be
      // pulled into config.json's session.
      makeAssembly('shared-assembly', 'config_other.json', 'other-id'),
      makeAssembly('shared-assembly', 'config.json', 'this-id'),
    ])

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
    expect(tracks[0]?.trackId).toBe('apollo_track_this-id')
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
