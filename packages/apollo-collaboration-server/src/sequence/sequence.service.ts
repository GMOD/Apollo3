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
import { LocalFile, RemoteFile } from 'generic-filehandle'
import { Model } from 'mongoose'

import { AssembliesService } from '../assemblies/assemblies.service'
import { GetSequenceDto } from './dto/get-sequence.dto'
import path from 'node:path'
import { LocalFileGzip } from '@apollo-annotation/shared'


@Injectable()
export class SequenceService {
  constructor(
    @InjectModel(File.name)
    private readonly fileModel: Model<FileDocument>,
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
      const { FILE_UPLOAD_FOLDER } = process.env
      if (!FILE_UPLOAD_FOLDER) {
        throw new Error('No FILE_UPLOAD_FOLDER found in .env file')
      }
      const faDoc = (await this.fileModel.findById(fa))
      const faChecksum = faDoc?.checksum
      if (!faChecksum) {
        throw new Error(`No checksum for file document ${faDoc}`)
      }

      const faiDoc = (await this.fileModel.findById(fai))
      const faiChecksum = faiDoc?.checksum
      if (!faiChecksum) {
        throw new Error(`No checksum for file document ${faiDoc}`)
      }

      const gziDoc = (await this.fileModel.findById(gzi))
      const gziChecksum = gziDoc?.checksum
      if (!gziChecksum) {
        throw new Error(`No checksum for file document ${gziDoc}`)
      }

      const sequenceAdapter = gzi
        ? new BgzipIndexedFasta({
          fasta: new LocalFile(path.join(FILE_UPLOAD_FOLDER, faChecksum)),  
           
          fai: new LocalFileGzip(path.join(FILE_UPLOAD_FOLDER, faiChecksum)),
           
          gzi: new LocalFileGzip(path.join(FILE_UPLOAD_FOLDER, gziChecksum)),
          })
        : new IndexedFasta({
            fasta: new LocalFile(fa),
            fai: new LocalFile(fai),
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
