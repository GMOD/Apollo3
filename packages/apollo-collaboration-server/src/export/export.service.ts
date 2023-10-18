import { Readable, Transform, pipeline } from 'node:stream'

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
  RefSeqDocument,
} from 'apollo-schemas'
import { Model } from 'mongoose'
import StreamConcat from 'stream-concat'

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async exportGFF3(exportID: string): Promise<any> {
    const exportDoc = await this.exportModel.findById(exportID)
    if (!exportDoc) {
      throw new NotFoundException()
    }

    const { assembly } = exportDoc
    const refSeqs = await this.refSeqModel.find({ assembly }).exec()

    const headerStream = new Readable({ objectMode: true })
    headerStream.push('##gff-version 3\n')
    for (const refSeqDoc of refSeqs) {
      headerStream.push(
        `##sequence-region ${refSeqDoc.name} 1 ${refSeqDoc.length}\n`,
      )
    }
    headerStream.push(null)

    const refSeqIds = refSeqs.map((refSeq) => refSeq._id)
    const query = { refSeq: { $in: refSeqIds } }

    const featureStream = pipeline(
      // unicorn thinks this is an Array.prototype.find, so we ignore it
      // eslint-disable-next-line unicorn/no-array-callback-reference
      this.featureModel.find(query).cursor(),
      new Transform({
        writableObjectMode: true,
        readableObjectMode: true,
        transform: (chunk, encoding, callback) => {
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
    const combinedStream = new StreamConcat([headerStream, featureStream])
    return [combinedStream, assembly]
  }
}
