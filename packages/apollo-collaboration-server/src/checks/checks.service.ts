/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-base-to-string */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { BgzipIndexedFasta, IndexedFasta } from '@gmod/indexedfasta'
import { Injectable, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { checkRegistry } from 'apollo-common'
import { AnnotationFeatureSnapshot } from 'apollo-mst'
import {
  Assembly,
  AssemblyDocument,
  Check,
  CheckDocument,
  CheckResult,
  CheckResultDocument,
  FeatureDocument,
  RefSeq,
  RefSeqChunk,
  RefSeqChunkDocument,
  RefSeqDocument,
} from 'apollo-schemas'
import { RemoteFile } from 'generic-filehandle'
import { Model } from 'mongoose'

import { FeatureRangeSearchDto } from '../entity/gff3Object.dto'
import { RefSeqsService } from '../refSeqs/refSeqs.service'

@Injectable()
export class ChecksService {
  constructor(
    @InjectModel(CheckResult.name)
    private readonly checkResultModel: Model<CheckResultDocument>,
    private readonly refSeqsService: RefSeqsService,
    @InjectModel(Check.name)
    private readonly checkModel: Model<CheckDocument>,
  ) {}

  private readonly logger = new Logger(ChecksService.name)

  async find({ assembly }: { assembly?: string }) {
    let query = {}
    if (assembly) {
      const refSeqs = await this.refSeqsService.findAll({ assembly })
      const refSeqIds = refSeqs.map((refSeq) => refSeq._id)
      query = { refSeq: { $in: refSeqIds } }
    }
    // eslint-disable-next-line unicorn/no-array-callback-reference
    return this.checkResultModel.find(query).exec()
  }

  async getChecks() {
    return this.checkModel.find().sort({ name: 1 }).exec()
  }

  async getChecksForAssembly(featureDoc: FeatureDocument) {
    const refSeqModel = featureDoc.$model<Model<RefSeqDocument>>(RefSeq.name)
    const refSeqId = featureDoc.refSeq.toString()
    const refSeqDoc = await refSeqModel.findById(refSeqId).exec()
    if (!refSeqDoc) {
      throw new Error(`Could not find refSeq ${refSeqId}`)
    }
    const { assembly } = refSeqDoc
    const assemblyModel = featureDoc.$model<Model<AssemblyDocument>>(
      Assembly.name,
    )
    const assemblyDoc = await assemblyModel
      .findById(assembly)
      .populate('checks')
    if (!assemblyDoc) {
      throw new Error(`Could not find assembly ${assembly}`)
    }
    return assemblyDoc.checks as unknown as CheckDocument[]
  }

  async checkFeature(
    doc: FeatureDocument,
    checkTimestamps = true,
  ): Promise<void> {
    const flatDoc: AnnotationFeatureSnapshot = doc.toObject({
      flattenMaps: true,
    })
    const checks = await this.getChecksForAssembly(doc)
    for (const check of checks) {
      if (checkTimestamps && doc.updatedAt && check.updatedAt < doc.updatedAt) {
        continue
      }
      const c = checkRegistry.getCheck(check.name)
      if (!c) {
        throw new Error(`Check "${check.name}" not registered`)
      }
      const result = await c.checkFeature(
        flatDoc,
        (start: number, end: number) => {
          return this.getSequence({ start, end, featureDoc: doc })
        },
      )
      await this.checkResultModel.insertMany(result)
    }
  }

  async getSequence({
    end,
    featureDoc,
    start,
  }: {
    end: number
    featureDoc: FeatureDocument
    start: number
  }) {
    const refSeqModel = featureDoc.$model<Model<RefSeqDocument>>(RefSeq.name)
    const refSeqId = featureDoc.refSeq.toString()
    const refSeqDoc = await refSeqModel.findById(refSeqId).exec()
    if (!refSeqDoc) {
      throw new Error(`Could not find refSeq ${refSeqId}`)
    }
    const { assembly, chunkSize, name } = refSeqDoc
    const assemblyModel = featureDoc.$model<Model<AssemblyDocument>>(
      Assembly.name,
    )
    const assemblyDoc = await assemblyModel.findById(assembly)
    if (!assemblyDoc) {
      throw new Error(`Could not find assembly ${assembly}`)
    }

    if (assemblyDoc.externalLocation) {
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
    const startChunk = Math.floor(start / chunkSize)
    const endChunk = Math.floor(end / chunkSize)
    const seq: string[] = []
    const refSeqChunkModel = featureDoc.$model<Model<RefSeqChunkDocument>>(
      RefSeqChunk.name,
    )
    for await (const refSeqChunk of refSeqChunkModel
      .find({
        refSeq: refSeqId,
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

  async clearChecksForFeature(featureDoc: FeatureDocument) {
    return this.checkResultModel
      .deleteMany({ ids: { $in: featureDoc.allIds } })
      .exec()
  }

  /**
   * Get all possible checkResults for given featureId
   * @param id - featureId
   * @returns - an array of checkResult -documents
   */
  async findByFeatureId(id: string) {
    return this.checkResultModel.find({ ids: id }).exec()
  }

  /**
   * Get all possible checkResults for given range (refSeq, start, end)
   * @param searchDto - range
   * @returns an array of checkResult-documents
   */
  async findByRange(searchDto: FeatureRangeSearchDto) {
    return this.checkResultModel
      .find({
        refSeq: searchDto.refSeq,
        start: { $lte: searchDto.end },
        end: { $gte: searchDto.start },
        status: 0,
      })
      .exec()
  }

  update(id: string, updatedCheckReport: CheckDocument) {
    return this.checkResultModel
      .findByIdAndUpdate(id, updatedCheckReport)
      .exec()
  }
}
