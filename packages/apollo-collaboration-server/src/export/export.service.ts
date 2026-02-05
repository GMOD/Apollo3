/* eslint-disable @typescript-eslint/no-unsafe-return */
import { createReadStream } from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'
import { ReadableStream, TransformStream } from 'node:stream/web'

import {
  Assembly,
  type AssemblyDocument,
  Export,
  type ExportDocument,
  Feature,
  type FeatureDocument,
  File,
  type FileDocument,
  RefSeq,
  RefSeqChunk,
  type RefSeqDocument,
} from '@apollo-annotation/schemas'
import { GFFFormattingTransformer } from '@gmod/gff'
import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectModel } from '@nestjs/mongoose'
import { type FilterQuery, Model } from 'mongoose'
import StreamConcat from 'stream-concat'

import {
  FeatureDocToGFF3FeatureStream,
  RefSeqChunkDocToFASTAStream,
  RefSeqDocToGFF3HeaderStream,
} from './transforms.js'

@Injectable()
export class ExportService {
  constructor(
    @InjectModel(Assembly.name)
    private readonly assemblyModel: Model<AssemblyDocument>,
    @InjectModel(Export.name)
    private readonly exportModel: Model<ExportDocument>,
    @InjectModel(Feature.name)
    private readonly featureModel: Model<FeatureDocument>,
    @InjectModel(File.name)
    private readonly fileModel: Model<FileDocument>,
    @InjectModel(RefSeq.name)
    private readonly refSeqModel: Model<RefSeqDocument>,
    @InjectModel(RefSeqChunk.name)
    private readonly refSeqChunksModel: Model<RefSeqDocument>,
    private readonly configService: ConfigService<
      { FILE_UPLOAD_FOLDER: string },
      true
    >,
  ) {}

  private readonly logger = new Logger(ExportService.name)

  async getAssemblyName(assemblyId: string) {
    const assemblyDoc = await this.assemblyModel.findById(assemblyId)
    if (!assemblyDoc) {
      throw new NotFoundException()
    }
    return assemblyDoc.name
  }

  async getExportID(assembly: string) {
    return this.exportModel.create({ assembly })
  }

  async exportGFF3(
    exportID: string,
    opts: { includeFASTA?: boolean; fastaWidth?: number },
  ): Promise<[Readable, string]> {
    const exportDoc = await this.exportModel.findById(exportID)
    if (!exportDoc) {
      throw new NotFoundException()
    }
    const { fastaWidth, includeFASTA } = opts
    const { assembly } = exportDoc
    const refSeqs = await this.refSeqModel.find({ assembly }).exec()
    const refSeqIds = refSeqs.map((refSeq) => refSeq._id)

    const headerStream = Readable.toWeb(
      this.refSeqModel.find({ assembly }).cursor(),
    ).pipeThrough(new RefSeqDocToGFF3HeaderStream())

    const query = { refSeq: { $in: refSeqIds } }
    const featureStream = Readable.toWeb(
      // unicorn thinks this is an Array.prototype.find, so we ignore it
      // eslint-disable-next-line unicorn/no-array-callback-reference
      this.featureModel.find(query).cursor(),
    )
      .pipeThrough(new FeatureDocToGFF3FeatureStream(refSeqs))
      .pipeThrough(
        new TransformStream(
          new GFFFormattingTransformer({ insertVersionDirective: false }),
        ),
      )

    let sequenceStreams: ReadableStream<string>[] = []
    if (includeFASTA) {
      const assemblyDoc = await this.assemblyModel.findById(assembly.toString())
      if (!assemblyDoc) {
        throw new Error(
          `Error getting document for assembly ${assembly.toString()}`,
        )
      }
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (assemblyDoc?.fileIds?.fai) {
        sequenceStreams = await this.streamFromLocalFasta(
          assemblyDoc.fileIds.fa,
        )
      } else if (assemblyDoc.externalLocation) {
        sequenceStreams = await this.streamFromRemoteFasta(
          assemblyDoc.externalLocation.fa,
        )
      } else {
        sequenceStreams = this.streamFromRefSeqCollection(query, fastaWidth)
      }
    }
    const streams = [headerStream, featureStream, ...sequenceStreams]
    const combinedStream: Readable = new StreamConcat(
      streams.map((stream) => Readable.fromWeb(stream)),
    )
    return [combinedStream, assembly.toString()]
  }

  async streamFromLocalFasta(
    fastaFileId: string,
  ): Promise<ReadableStream<string>[]> {
    const faDoc = await this.fileModel.findById(fastaFileId)
    if (!faDoc) {
      throw new Error('Undefined document')
    }
    const fastaLineStream = new ReadableStream({
      start(controller) {
        controller.enqueue('##FASTA\n')
        controller.close()
      },
    })

    const fileUploadFolder = this.configService.get('FILE_UPLOAD_FOLDER', {
      infer: true,
    })
    const fileStream = Readable.toWeb(
      createReadStream(path.join(fileUploadFolder, faDoc.checksum)),
    )
    const gunzip = new DecompressionStream('gzip')
    return [fastaLineStream, fileStream.pipeThrough(gunzip)]
  }

  async streamFromRemoteFasta(
    fastaUrl: string,
  ): Promise<ReadableStream<string>[]> {
    const fastaLineStream = new ReadableStream({
      start(controller) {
        controller.enqueue('##FASTA\n')
        controller.close()
      },
    })

    const response = await fetch(fastaUrl)
    if (response.body === null) {
      throw new Error(`No body in response from ${fastaUrl}`)
    }

    const gunzip = new DecompressionStream('gzip')
    return [fastaLineStream, response.body.pipeThrough(gunzip)]
  }

  streamFromRefSeqCollection(
    query: FilterQuery<RefSeqDocument>,
    fastaWidth?: number,
  ): ReadableStream<string>[] {
    const sequenceStream = Readable.toWeb(
      this.refSeqChunksModel
        // unicorn thinks this is an Array.prototype.find, so we ignore it
        // eslint-disable-next-line unicorn/no-array-callback-reference
        .find(query)
        .sort({ refSeq: 1, n: 1 })
        .populate('refSeq')
        .cursor(),
    ).pipeThrough(new RefSeqChunkDocToFASTAStream({ fastaWidth }))
    return [sequenceStream]
  }
}
