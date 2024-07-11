/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-base-to-string */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import {
  RefSeq,
  RefSeqChunk,
  RefSeqChunkDocument,
  RefSeqDocument,
} from '@apollo-annotation/schemas'
import { BgzipIndexedFasta, IndexedFasta } from '@gmod/indexedfasta'
import { Injectable, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { LocalFile, RemoteFile, GenericFilehandle } from 'generic-filehandle'
import { Model } from 'mongoose'

import { AssembliesService } from '../assemblies/assemblies.service'
import { GetSequenceDto } from './dto/get-sequence.dto'

class ApolloFastaIndexFileHandle implements GenericFilehandle {
  // Implement what needed
  // readFile method unzip and return all file
}

@Injectable()
export class SequenceService {
  constructor(
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

    if (assemblyDoc?.fileLocation) {
      const { fa, fai, gzi } = assemblyDoc.fileLocation
      this.logger.debug(
        `Local fasta file = ${fa}, Local fasta index file = ${fai}`,
      )

      // mongodb lookup to get paths from IDs

      const sequenceAdapter = gzi
        ? new BgzipIndexedFasta({
            fasta: new LocalFile(fa),
            fai: new LocalFile(fai), // Use ApolloFasta...
            gzi: new LocalFile(gzi),
          })
        : new IndexedFasta({
            fasta: new LocalFile(fa),
            fai: new LocalFile(fai),
          })
      // extend or make a class that implements fileHandle interface to read compressed files.
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
