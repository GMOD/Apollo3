import {
  Readable,
  Transform,
  TransformCallback,
  TransformOptions,
  pipeline,
} from 'node:stream'

import gff from '@gmod/gff'
import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { AnnotationFeatureSnapshot } from 'apollo-mst'
import {
  Assembly,
  AssemblyDocument,
  Export,
  ExportDocument,
  Feature,
  FeatureDocument,
  RefSeq,
  RefSeqChunk,
  RefSeqChunkDocument,
  RefSeqDocument,
} from 'apollo-schemas'
import { makeGFF3Feature, splitStringIntoChunks } from 'apollo-shared'
import { Model } from 'mongoose'
import StreamConcat from 'stream-concat'

interface FastaTransformOptions extends TransformOptions {
  fastaWidth?: number
}

class FastaTransform extends Transform {
  lineBuffer = ''
  currentRefSeq?: string = undefined
  fastaWidth

  constructor(opts: FastaTransformOptions) {
    super({ ...opts, objectMode: true })
    const { fastaWidth = 80 } = opts
    this.fastaWidth = fastaWidth
    this.push('##FASTA\n')
  }

  _transform(
    refSeqChunkDoc: RefSeqChunkDocument,
    encoding: BufferEncoding,
    callback: TransformCallback,
  ): void {
    const refSeqDoc = refSeqChunkDoc.refSeq
    const refSeqDocId = refSeqDoc._id.toString()
    if (refSeqDocId !== this.currentRefSeq) {
      this.flushLineBuffer()
      const refSeqDescription = refSeqDoc.description
        ? ` ${refSeqDoc.description}`
        : ''
      const fastaHeader = `>${refSeqDoc.name}${refSeqDescription}\n`
      this.push(fastaHeader)
      this.currentRefSeq = refSeqDocId
    }
    let { sequence } = refSeqChunkDoc
    if (this.lineBuffer) {
      const neededLength = this.fastaWidth - this.lineBuffer.length
      const bufferFiller = sequence.slice(0, neededLength)
      sequence = sequence.slice(neededLength)
      this.lineBuffer += bufferFiller
      if (this.lineBuffer.length === this.fastaWidth) {
        this.flushLineBuffer()
      } else {
        return callback()
      }
    }
    const seqLines = splitStringIntoChunks(sequence, this.fastaWidth)
    const lastLine = seqLines.at(-1) ?? ''
    if (lastLine.length > 0 && lastLine.length !== this.fastaWidth) {
      this.lineBuffer = seqLines.pop() ?? ''
    }
    if (seqLines.length > 0) {
      this.push(`${seqLines.join('\n')}\n`)
    }
    callback()
  }

  flushLineBuffer() {
    if (this.lineBuffer) {
      this.push(`${this.lineBuffer}\n`)
      this.lineBuffer = ''
    }
  }

  _flush(callback: TransformCallback): void {
    this.flushLineBuffer()
    callback()
  }
}

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
    @InjectModel(RefSeqChunk.name)
    private readonly refSeqChunksModel: Model<RefSeqDocument>,
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
    opts: { fastaWidth?: number },
  ): Promise<[Readable, string]> {
    const exportDoc = await this.exportModel.findById(exportID)
    if (!exportDoc) {
      throw new NotFoundException()
    }
    const { fastaWidth } = opts

    const { assembly } = exportDoc
    const refSeqs = await this.refSeqModel.find({ assembly }).exec()
    const refSeqIds = refSeqs.map((refSeq) => refSeq._id)

    const headerStream = pipeline(
      this.refSeqModel.find({ assembly }).cursor(),
      new Transform({
        objectMode: true,
        construct(callback) {
          this.push('##gff-version 3\n')
          callback()
        },
        transform(chunk: RefSeqDocument, encoding, callback) {
          this.push(`##sequence-region ${chunk.name} 1 ${chunk.length}\n`)
          callback()
        },
      }),
      (error) => {
        if (error) {
          this.logger.error('GFF3 export failed')
          this.logger.error(error)
        }
      },
    )

    const query = { refSeq: { $in: refSeqIds } }
    const featureStream = pipeline(
      // unicorn thinks this is an Array.prototype.find, so we ignore it
      // eslint-disable-next-line unicorn/no-array-callback-reference
      this.featureModel.find(query).cursor(),
      new Transform({
        objectMode: true,
        transform: (chunk: FeatureDocument, encoding, callback) => {
          try {
            const flattened = chunk.toObject({ flattenMaps: true })
            const refSeqNames = Object.fromEntries(
              refSeqs.map((refSeq) => [refSeq._id, refSeq.name]),
            )
            const gff3Feature = makeGFF3Feature(
              flattened as unknown as AnnotationFeatureSnapshot,
              undefined,
              refSeqNames,
            )
            callback(null, gff3Feature)
          } catch (error) {
            callback(error instanceof Error ? error : new Error(String(error)))
          }
        },
      }),
      gff.formatStream({ insertVersionDirective: true }),
      (error) => {
        if (error) {
          this.logger.error('GFF3 export failed')
          this.logger.error(error)
        }
      },
    )

    const sequenceStream = pipeline(
      this.refSeqChunksModel
        // unicorn thinks this is an Array.prototype.find, so we ignore it
        // eslint-disable-next-line unicorn/no-array-callback-reference
        .find(query)
        .sort({ refSeq: 1, n: 1 })
        .populate('refSeq')
        .cursor(),
      new FastaTransform({ fastaWidth }),
      (error) => {
        if (error) {
          this.logger.error('GFF3 export failed')
          this.logger.error(error)
        }
      },
    )

    const combinedStream: Readable = new StreamConcat([
      headerStream,
      featureStream,
      sequenceStream,
    ])
    return [combinedStream, assembly.toString()]
  }
}
