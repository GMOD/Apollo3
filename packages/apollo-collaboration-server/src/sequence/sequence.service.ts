/* eslint-disable @typescript-eslint/no-base-to-string */

import {
  File,
  type FileDocument,
  RefSeq,
  RefSeqChunk,
  type RefSeqChunkDocument,
  type RefSeqDocument,
} from '@apollo-annotation/schemas'
import { BgzipIndexedFasta, IndexedFasta } from '@gmod/indexedfasta'
import { Injectable, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { type GenericFilehandle, RemoteFile } from 'generic-filehandle2'
import { Model } from 'mongoose'
import QuickLRU from 'quick-lru'

import { AssembliesService } from '../assemblies/assemblies.service.js'
import { FilesService } from '../files/files.service.js'

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
    @InjectModel(File.name)
    private readonly fileModel: Model<FileDocument>,
    private readonly filesService: FilesService,
    @InjectModel(RefSeqChunk.name)
    private readonly refSeqChunkModel: Model<RefSeqChunkDocument>,
    @InjectModel(RefSeq.name)
    private readonly refSeqModel: Model<RefSeqDocument>,
    private readonly assembliesService: AssembliesService,
  ) {}

  private readonly logger = new Logger(SequenceService.name)

  async getSequence({ end, refSeq: refSeqId, start }: GetSequenceDto) {
    let refSeq: RefSeqDocument | null | undefined = refSeqDocLRU.get(
      String(refSeqId),
    )
    if (!refSeq) {
      refSeq = await this.refSeqModel.findById(refSeqId)
      if (!refSeq) {
        throw new Error(`RefSeq "${refSeqId}" not found`)
      }
      refSeqDocLRU.set(String(refSeqId), refSeq)
    }

    const { assembly, chunkSize, name } = refSeq
    const assemblyDoc = await this.assembliesService.findOne(
      assembly.toString(),
    )

    if (assemblyDoc.externalLocation) {
      const { fa, fai, gzi } = assemblyDoc.externalLocation
      const adapterCacheEntry = adapterLRU.get(fa)
      let sequenceAdapter = adapterCacheEntry?.adapter

      if (!sequenceAdapter) {
        const fastaHandle = new RemoteFile(fa, { fetch })
        const faiHandle = new RemoteFile(fa, { fetch })
        if (gzi) {
          const gziHandle = new RemoteFile(fa, { fetch })
          sequenceAdapter = new BgzipIndexedFasta({
            fasta: fastaHandle,
            fai: faiHandle,
            gzi: gziHandle,
          })
          adapterLRU.set(fa, {
            adapter: sequenceAdapter,
            fileHandles: [fastaHandle, faiHandle, gziHandle],
          })
        } else {
          sequenceAdapter = new IndexedFasta({
            fasta: fastaHandle,
            fai: new RemoteFile(fai, { fetch }),
          })
          adapterLRU.set(fa, {
            adapter: sequenceAdapter,
            fileHandles: [fastaHandle, faiHandle],
          })
        }
      }
      const sequence = await sequenceAdapter.getSequence(name, start, end)
      if (sequence === undefined) {
        throw new Error('Sequence not found')
      }
      return sequence
    }

    if (assemblyDoc.fileIds?.fai) {
      const { fa: faId, fai: faiId, gzi: gziId } = assemblyDoc.fileIds
      const adapterCacheEntry = adapterLRU.get(String(faId))
      let sequenceAdapter = adapterCacheEntry?.adapter
      if (!sequenceAdapter) {
        const faDoc = await this.fileModel.findById(faId)
        if (!faDoc) {
          throw new Error(`No checksum for file document ${faId}`)
        }

        const faiDoc = await this.fileModel.findById(faiId)
        if (!faiDoc) {
          throw new Error(`File document not found for ${faiId}`)
        }

        const gziDoc = await this.fileModel.findById(gziId)
        if (!gziDoc) {
          throw new Error(`File document not found for ${gziId}`)
        }

        const fasta = this.filesService.getFileHandle(faDoc)
        const fai = this.filesService.getFileHandle(faiDoc)
        const gzi = gziId ? this.filesService.getFileHandle(gziDoc) : undefined
        sequenceAdapter = gziId
          ? new BgzipIndexedFasta({ fasta, fai, gzi })
          : new IndexedFasta({ fasta, fai })
        const fileHandles = [fasta, fai]
        if (gzi) {
          fileHandles.push(gzi)
        }
        adapterLRU.set(String(faId), { adapter: sequenceAdapter, fileHandles })
      }
      const sequence = await sequenceAdapter.getSequence(name, start, end)
      if (sequence === undefined) {
        throw new Error('Sequence not found')
      }
      return sequence
    }

    const startChunk = Math.floor(start / chunkSize)
    const endChunk = Math.floor(end / chunkSize)
    const seq: string[] = []
    for await (const refSeqChunk of this.refSeqChunkModel
      .find({
        refSeq,
        $and: [{ n: { $gte: startChunk } }, { n: { $lte: endChunk } }],
      })
      .sort({ n: 1 })) {
      const { n, sequence } = refSeqChunk
      if (n === startChunk || n === endChunk) {
        seq.push(
          sequence.slice(
            n === startChunk ? start - n * chunkSize : undefined,
            n === endChunk ? end - n * chunkSize : undefined,
          ),
        )
      } else {
        seq.push(sequence)
      }
    }
    return seq.join('')
  }
}
