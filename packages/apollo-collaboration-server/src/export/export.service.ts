import { Readable } from 'node:stream'
import { ReadableStream, TransformStream } from 'node:stream/web'

import {
  Assembly,
  type AssemblyDocument,
  Export,
  type ExportDocument,
  Feature,
  type FeatureDocument,
  RefSeq,
  type RefSeqDocument,
} from '@apollo-annotation/schemas'
import { GFFFormattingTransformer } from '@gmod/gff'
import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import StreamConcat from 'stream-concat'

import { JBrowseConfigService } from '../jbrowse/jbrowseConfig.service.js'

import {
  FeatureDocToGFF3FeatureStream,
  RefSeqDocToAdapterFASTAStream,
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
    @InjectModel(RefSeq.name)
    private readonly refSeqModel: Model<RefSeqDocument>,
    private readonly jbrowseConfigService: JBrowseConfigService,
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
      sequenceStreams = await this.streamFromAdapter(
        assemblyDoc.name,
        assemblyDoc.configId,
        refSeqs,
        fastaWidth,
      )
    }
    const streams = [headerStream, featureStream, ...sequenceStreams]
    const combinedStream: Readable = new StreamConcat(
      streams.map((stream) => Readable.fromWeb(stream)),
    )
    return [combinedStream, assembly.toString()]
  }

  async streamFromAdapter(
    assemblyName: string,
    configId: string,
    refSeqs: RefSeqDocument[],
    fastaWidth?: number,
  ): Promise<ReadableStream<string>[]> {
    const sequenceAdapter =
      await this.jbrowseConfigService.getSequenceAdapterForAssembly(
        assemblyName,
        configId,
      )
    const sequenceStream = Readable.toWeb(Readable.from(refSeqs)).pipeThrough(
      new RefSeqDocToAdapterFASTAStream(sequenceAdapter, { fastaWidth }),
    )
    return [sequenceStream]
  }
}
