import { JBrowseConfig } from '@apollo-annotation/schemas'
import { ConfigService } from '@nestjs/config'
import { getModelToken } from '@nestjs/mongoose'
import { Test, type TestingModule } from '@nestjs/testing'

import { AssembliesService } from '../assemblies/assemblies.service.js'
import { RefSeqsService } from '../refSeqs/refSeqs.service.js'

import { JBrowseService, mergeJBrowseConfig } from './jbrowse.service.js'

describe('JBrowseService', () => {
  let service: JBrowseService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JBrowseService,
        { provide: AssembliesService, useValue: {} },
        { provide: RefSeqsService, useValue: {} },
        { provide: getModelToken(JBrowseConfig.name), useValue: {} },
        { provide: ConfigService, useValue: {} },
      ],
    }).compile()

    service = module.get<JBrowseService>(JBrowseService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})

describe('mergeJBrowseConfig', () => {
  const apollo = { name: 'Apollo', url: 'http://server/apollo.js' }

  it('puts the generated Apollo plugin first', () => {
    const merged = mergeJBrowseConfig(
      { plugins: [apollo] },
      { plugins: [{ name: 'Other', url: 'other.js' }] },
    )
    expect(merged.plugins).toEqual([apollo, { name: 'Other', url: 'other.js' }])
  })

  it('drops an Apollo plugin from the stored config', () => {
    const merged = mergeJBrowseConfig(
      { plugins: [apollo] },
      {
        plugins: [
          { name: 'Other', url: 'other.js' },
          { name: 'Apollo', url: 'old/apollo.js' },
        ],
      },
    )
    expect(merged.plugins).toEqual([apollo, { name: 'Other', url: 'other.js' }])
  })

  it('concatenates other arrays', () => {
    const merged = mergeJBrowseConfig(
      { plugins: [apollo], tracks: [{ trackId: 'a' }] },
      { tracks: [{ trackId: 'b' }] },
    )
    expect(merged.tracks).toEqual([{ trackId: 'a' }, { trackId: 'b' }])
  })
})
