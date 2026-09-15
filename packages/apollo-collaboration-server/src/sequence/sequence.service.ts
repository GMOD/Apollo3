import { RefSeq, type RefSeqDocument } from '@apollo-annotation/schemas'
import { BgzipIndexedFasta, IndexedFasta } from '@gmod/indexedfasta'
import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { type GenericFilehandle } from 'generic-filehandle2'
import { Model } from 'mongoose'
import QuickLRU from 'quick-lru'

import { AssembliesService } from '../assemblies/assemblies.service.js'
import { JBrowseConfigService } from '../jbrowse/jbrowseConfig.service.js'

import { GetSequenceDto } from './dto/get-sequence.dto.js'

interface AdapterCache {
  adapter: IndexedFasta | BgzipIndexedFasta
  fileHandles: GenericFilehandle[]
}

const adapterLRU = new QuickLRU<string, AdapterCache>({
  maxSize: 100,
  maxAge: 24 * 60 * 60 * 1000,
  onEviction(key, adapter) {
    const { fileHandles } = adapter
    for (const fileHandle of fileHandles) {
      void fileHandle.close()
    }
  },
})

const refSeqDocLRU = new QuickLRU<string, RefSeqDocument>({
  maxSize: 100,
  maxAge: 24 * 60 * 60 * 1000,
})

@Injectable()
export class SequenceService {
  constructor(
    @InjectModel(RefSeq.name)
    private readonly refSeqModel: Model<RefSeqDocument>,
    @Inject(forwardRef(() => AssembliesService))
    private readonly assembliesService: Readonly<AssembliesService>,
    private readonly jbrowseConfigService: JBrowseConfigService,
  ) {}

  private readonly logger = new Logger(SequenceService.name)

  async getSequence({ end, refSeq: refSeqId, start }: GetSequenceDto) {
    let refSeq: RefSeqDocument | null | undefined = refSeqDocLRU.get(refSeqId)
    if (!refSeq) {
      refSeq = await this.refSeqModel.findById(refSeqId)
      if (!refSeq) {
        throw new Error(`RefSeq "${refSeqId}" not found`)
      }
      refSeqDocLRU.set(refSeqId, refSeq)
    }

    const { assembly, name } = refSeq
    const assemblyDoc = await this.assembliesService.findOne(
      assembly.toString(),
    )

    const adapterCacheEntry = adapterLRU.get(assemblyDoc.name)
    let sequenceAdapter = adapterCacheEntry?.adapter
    if (!sequenceAdapter) {
      sequenceAdapter =
        await this.jbrowseConfigService.getSequenceAdapterForAssembly(
          assemblyDoc.name,
        )
      adapterLRU.set(assemblyDoc.name, {
        adapter: sequenceAdapter,
        fileHandles: [],
      })
    }
    const sequence = await sequenceAdapter.getSequence(name, start, end)
    if (sequence === undefined) {
      throw new Error('Sequence not found')
    }
    return sequence
  }
}
