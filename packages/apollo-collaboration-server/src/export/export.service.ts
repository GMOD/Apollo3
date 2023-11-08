import {
  Readable,
  Transform,
  TransformCallback,
  TransformOptions,
  pipeline,
} from 'node:stream'

import gff, { GFF3Feature } from '@gmod/gff'
import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
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

function splitStringIntoChunks(input: string, chunkSize: number): string[] {
  const chunks: string[] = []
  for (let i = 0; i < input.length; i += chunkSize) {
    const chunk = input.slice(i, i + chunkSize)
    chunks.push(chunk)
  }
  return chunks
}

function makeGFF3Feature(
  featureDocument: Feature,
  refSeqs: RefSeqDocument[],
  parentId?: string,
): GFF3Feature {
  const locations = featureDocument.discontinuousLocations?.length
    ? featureDocument.discontinuousLocations
    : [
        {
          start: featureDocument.start,
          end: featureDocument.end,
          phase: featureDocument.phase,
        },
      ]
  const attributes: Record<string, string[]> = { ...featureDocument.attributes }
  const ontologyTerms: string[] = []
  const source = featureDocument.attributes?.source?.[0] ?? null
  delete attributes.source
  if (parentId) {
    attributes.Parent = [parentId]
  }
  if (attributes._id) {
    attributes.ID = attributes._id
    delete attributes._id
  }
  if (attributes.gff_name) {
    attributes.Name = attributes.gff_name
    delete attributes.gff_name
  }
  if (attributes.gff_alias) {
    attributes.Alias = attributes.gff_alias
    delete attributes.gff_alias
  }
  if (attributes.gff_target) {
    attributes.Target = attributes.gff_target
    delete attributes.gff_target
  }
  if (attributes.gff_gap) {
    attributes.Gap = attributes.gff_gap
    delete attributes.gff_gap
  }
  if (attributes.gff_derives_from) {
    attributes.Derives_from = attributes.gff_derives_from
    delete attributes.gff_derives_from
  }
  if (attributes.gff_note) {
    attributes.Note = attributes.gff_note
    delete attributes.gff_note
  }
  if (attributes.gff_dbxref) {
    attributes.Dbxref = attributes.gff_dbxref
    delete attributes.gff_dbxref
  }
  if (attributes.gff_is_circular) {
    attributes.Is_circular = attributes.gff_is_circular
    delete attributes.gff_is_circular
  }
  if (attributes.gff_ontology_term) {
    ontologyTerms.push(...attributes.gff_ontology_term)
    delete attributes.gff_ontology_term
  }
  if (attributes['Gene Ontology']) {
    ontologyTerms.push(...attributes['Gene Ontology'])
    delete attributes['Gene Ontology']
  }
  if (attributes['Sequence Ontology']) {
    ontologyTerms.push(...attributes['Sequence Ontology'])
    delete attributes['Sequence Ontology']
  }
  if (ontologyTerms.length > 0) {
    attributes.Ontology_term = ontologyTerms
  }
  const refSeq = refSeqs.find((rs) => rs._id.equals(featureDocument.refSeq))
  if (!refSeq) {
    throw new Error(`Could not find refSeq ${featureDocument.refSeq}`)
  }
  return locations.map((location) => ({
    start: location.start,
    end: location.end,
    seq_id: refSeq.name,
    source,
    type: featureDocument.type,
    score: featureDocument.score ?? null,
    strand: featureDocument.strand
      ? featureDocument.strand === 1
        ? '+'
        : '-'
      : null,
    phase:
      location.phase === 0
        ? '0'
        : location.phase === 1
        ? '1'
        : location.phase === 2
        ? '2'
        : null,
    attributes: Object.keys(attributes).length > 0 ? attributes : null,
    derived_features: [],
    child_features: featureDocument.children
      ? Object.values(featureDocument.children).map((child) =>
          makeGFF3Feature(child, refSeqs, attributes.ID[0]),
        )
      : [],
  }))
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
            const gff3Feature = makeGFF3Feature(flattened, refSeqs)
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
