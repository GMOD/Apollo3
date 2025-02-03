/* eslint-disable @typescript-eslint/no-confusing-void-expression */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import {
  Readable,
  Transform,
  TransformCallback,
  TransformOptions,
  pipeline,
} from 'node:stream'

import { ReadableStream } from 'node:stream/web'

import { AnnotationFeatureSnapshot } from '@apollo-annotation/mst'
import {
  Assembly,
  AssemblyDocument,
  Export,
  ExportDocument,
  Feature,
  FeatureDocument,
  FileDocument,
  RefSeq,
  RefSeqChunk,
  RefSeqChunkDocument,
  RefSeqDocument,
} from '@apollo-annotation/schemas'
import {
  annotationFeatureToGFF3,
  splitStringIntoChunks,
} from '@apollo-annotation/shared'
import gff from '@gmod/gff'
import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { FilterQuery, Model } from 'mongoose'
import StreamConcat from 'stream-concat'
import { FilesService } from 'src/files/files.service'
import { createReadStream } from 'node:fs'
import { ConfigService } from '@nestjs/config'
import path from 'node:path'
import { createGunzip } from 'node:zlib'

interface FastaTransformOptions extends TransformOptions {
  fastaWidth?: number
}

function makeFastaHeader(refSeqDoc: {
  description: string
  name: string
}): string {
  const refSeqDescription = refSeqDoc.description
    ? ` ${refSeqDoc.description}`
    : ''
  return `>${refSeqDoc.name}${refSeqDescription}\n`
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
      this.push(makeFastaHeader(refSeqDoc))
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
    @InjectModel(File.name)
    private readonly fileModel: Model<FileDocument>,
    private readonly filesService: FilesService,
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
    opts: { withFasta?: boolean; fastaWidth?: number },
  ): Promise<[Readable, string]> {
    const exportDoc = await this.exportModel.findById(exportID)
    if (!exportDoc) {
      throw new NotFoundException()
    }
    const { fastaWidth, withFasta } = opts
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
            const gff3Feature = annotationFeatureToGFF3(
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
          this.logger.error('GFF3 export failed here')
          this.logger.error(error)
        }
      },
    )

    let sequenceStream: Readable[] = []
    if (withFasta) {
      const assemblyDoc = await this.assemblyModel.findById(assembly.toString())
      if (!assemblyDoc) {
        throw new Error(
          `Error getting document for assembly ${assembly.toString()}`,
        )
      }
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (assemblyDoc?.fileIds?.fai) {
        sequenceStream = await this.streamFromLocalFasta(assemblyDoc.fileIds.fa)
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      } else if (assemblyDoc.externalLocation) {
        sequenceStream = await this.streamFromRemoteFasta(
          assemblyDoc.externalLocation.fa,
        )
      } else {
        sequenceStream = this.streamFromRefSeqCollection(
          query,
          new FastaTransform({ fastaWidth }).fastaWidth,
        )
      }
    }
    const combinedStream: Readable = new StreamConcat([
      headerStream,
      featureStream,
      ...sequenceStream,
    ])
    return [combinedStream, assembly.toString()]
  }

  async streamFromLocalFasta(fastaFileId: string): Promise<Readable[]> {
    const faDoc = await this.fileModel.findById(fastaFileId)
    if (!faDoc) {
      throw new Error('Undefined document')
    }
    const fastaLineStream = new Readable()
    fastaLineStream.push('##FASTA\n')
    // eslint-disable-next-line unicorn/no-array-push-push
    fastaLineStream.push(null)

    const fileUploadFolder = this.configService.get('FILE_UPLOAD_FOLDER', {
      infer: true,
    })
    const fileStream = createReadStream(
      path.join(fileUploadFolder, faDoc.checksum),
    )
    const gunzip = createGunzip()
    return [fastaLineStream, fileStream.pipe(gunzip)]
  }

  async streamFromRemoteFasta(fastaUrl: string): Promise<Readable[]> {
    const fastaLineStream = new Readable()
    fastaLineStream.push('##FASTA\n')
    // eslint-disable-next-line unicorn/no-array-push-push
    fastaLineStream.push(null)

    const response = await fetch(fastaUrl)
    if (response.body === null) {
      throw new Error(`No body in response from ${fastaUrl}`)
    }

    const gunzip = createGunzip()
    const fastaData = Readable.fromWeb(response.body as ReadableStream)
    return [fastaLineStream, fastaData.pipe(gunzip)]
  }

  streamFromRefSeqCollection(
    query: FilterQuery<RefSeqDocument>,
    fastaWidth: number,
  ) {
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
    return [sequenceStream]
  }
}
