/* eslint-disable @typescript-eslint/restrict-template-expressions */

/* eslint-disable @typescript-eslint/no-base-to-string */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import {
  File,
  FileDocument,
  RefSeq,
  RefSeqChunk,
  RefSeqChunkDocument,
  RefSeqDocument,
} from '@apollo-annotation/schemas'
import { BgzipIndexedFasta, IndexedFasta } from '@gmod/indexedfasta'
import { Injectable, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { RemoteFile } from 'generic-filehandle'
import { Model } from 'mongoose'

import { AssembliesService } from '../assemblies/assemblies.service'
import { FilesService } from '../files/files.service'
import { GetSequenceDto } from './dto/get-sequence.dto'

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
    const refSeq = await this.refSeqModel.findById(refSeqId)
    if (!refSeq) {
      throw new Error(`RefSeq "${refSeqId}" not found`)
    }

    const { assembly, chunkSize, name } = refSeq
    const assemblyDoc = await this.assembliesService.findOne(
      assembly.toString(),
    )

    if (assemblyDoc?.externalLocation) {
      const { fa, fai, gzi } = assemblyDoc.externalLocation
      this.logger.debug(`Fasta file URL = ${fa}, Fasta index file URL = ${fai}`)

      const sequenceAdapter = gzi
        ? new BgzipIndexedFasta({
            fasta: new RemoteFile(fa, { fetch }),
            fai: new RemoteFile(fai, { fetch }),
            gzi: new RemoteFile(gzi, { fetch }),
          })
        : new IndexedFasta({
            fasta: new RemoteFile(fa, { fetch }),
            fai: new RemoteFile(fai, { fetch }),
          })
      const sequence = await sequenceAdapter.getSequence(name, start, end)
      if (sequence === undefined) {
        throw new Error('Sequence not found')
      }
      return sequence
    }

    if (assemblyDoc?.fileIds) {
      const { fa, fai, gzi } = assemblyDoc.fileIds
      this.logger.debug(
        `Local fasta file = ${fa}, Local fasta index file = ${fai}`,
      )
      const faDoc = await this.fileModel.findById(fa)
      if (!faDoc) {
        throw new Error(`No checksum for file document ${fa}`)
      }

      const faiDoc = await this.fileModel.findById(fai)
      if (!faiDoc) {
        throw new Error(`File document not found for ${fai}`)
      }

      const gziDoc = await this.fileModel.findById(gzi)
      if (!gziDoc) {
        throw new Error(`File document not found for ${gzi}`)
      }

      const sequenceAdapter = gzi
        ? new BgzipIndexedFasta({
            fasta: this.filesService.getFileHandle(faDoc),
            fai: this.filesService.getFileHandle(faiDoc),
            gzi: this.filesService.getFileHandle(gziDoc),
          })
        : new IndexedFasta({
            fasta: this.filesService.getFileHandle(faDoc),
            fai: this.filesService.getFileHandle(faiDoc),
          })
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
