import { IndexedFasta } from '@gmod/indexedfasta'
import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import {
  Assembly,
  AssemblyDocument,
  CheckReport,
  CheckReportDocument,
  Feature,
  FeatureDocument,
  RefSeq,
  RefSeqChunk,
  RefSeqDocument,
} from 'apollo-schemas'
import { RemoteFile } from 'generic-filehandle'
import { Model } from 'mongoose'

interface Range {
  start: number
  end: number
}
@Injectable()
export class ChecksService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(
    // private readonly sequenceService: SequenceService,
    @InjectModel(CheckReport.name)
    private readonly checkReportModel: Model<CheckReportDocument>,
  ) {}

  private readonly logger = new Logger(ChecksService.name)

  async checkFeature(doc: FeatureDocument) {
    const featureModel = doc.$model<Model<FeatureDocument>>(Feature.name)
    // this.logger.debug(`Feature Model: ${featureModel}`)
    // const features = await featureModel.find().exec()
    // this.logger.log(features[0])
    // this.logger.debug(`RefSeq Model: ${refSeqModel}`)
    // const refSeqs = await refSeqModel.find().exec()
    // this.logger.log(refSeqs[0])
    const featureDoc = await featureModel.findById(doc._id).exec()
    if (!featureDoc) {
      const errMsg = 'ERROR when searching feature by featureId'
      this.logger.error(errMsg)
      throw new NotFoundException(errMsg)
    }
    const emptyRangeArray: Range[] = []
    await this.checkCodon(featureDoc, featureDoc, emptyRangeArray)
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
      const { fa, fai } = assemblyDoc.externalLocation
      this.logger.debug(`Fasta file URL = ${fa}, Fasta index file URL = ${fai}`)

      const indexedFasta = new IndexedFasta({
        fasta: new RemoteFile(fa, { fetch }),
        fai: new RemoteFile(fai, { fetch }),
      })
      return indexedFasta.getSequence(name, start, end)
    }

    const startChunk = Math.floor(start / chunkSize)
    const endChunk = Math.floor(end / chunkSize)
    const seq: string[] = []
    const refSeqChunkModel = featureDoc.$model<Model<RefSeqChunk>>(
      Assembly.name,
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

  /**
   * Checks suspicious start and stop codons. Also check if CDS sequence is divisible by 3
   * @param feature - feature
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/ban-types
  async checkCodon(
    featureDoc: FeatureDocument,
    feature: Feature,
    cdsRangesArray: Range[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/ban-types
  ) {
    if (feature.type === 'CDS') {
      const tmp1 = JSON.parse(JSON.stringify(feature))
      this.logger.debug(
        `*** Run checkCodon -check report for feature ${feature._id}, type=${
          feature.type
        }, strand=${feature.strand}, start=${feature.start}, end=${
          feature.end
        }, lenght=${feature.end - feature.start}`,
      )
      const featSeqOrig = await this.getSequence({
        featureDoc,
        start: feature.start,
        end: feature.end,
      })
      if (!featSeqOrig) {
        const errMsg = 'ERROR - No feature sequence was found!'
        this.logger.error(errMsg)
        throw new NotFoundException(errMsg)
      }
      let featSeq: string
      // eslint-disable-next-line unicorn/prefer-ternary
      if (feature.strand === -1) {
        // If negative strand then reverse sequence
        // eslint-disable-next-line unicorn/prefer-spread
        featSeq = featSeqOrig.split('').reverse().join('')
      } else {
        featSeq = featSeqOrig
      }

      // Check if new CDS overlaps in previous CDSs
      const isOverlapFound = this.isOverlap(
        feature.start,
        feature.end,
        cdsRangesArray,
      )

      if (isOverlapFound) {
        const errMsg = `CDS (start: ${feature.start}, end: ${feature.end}) overlaps with other CDS.`
        this.logger.error(`ERROR - ${errMsg}`)
        await this.checkReportModel.create([
          {
            checkName: 'StopCodonCheckReport',
            ids: [feature._id],
            pass: false,
            ignored: '',
            problems: errMsg,
          },
        ])
      } else {
        cdsRangesArray.push({ start: feature.start, end: feature.end })
      }
      const startBase = featSeq.slice(0, 3).toUpperCase()
      if (startBase !== 'ATG' && startBase !== 'GTG' && startBase !== 'TTG') {
        const errMsg = `Found suspicious start codon "${featSeq.slice(
          0,
          3,
        )}" in the beginning of the CDS sequence.`
        this.logger.error(`ERROR - ${errMsg}`)
        await this.checkReportModel.create([
          {
            checkName: 'StopCodonCheckReport',
            ids: [feature._id],
            pass: false,
            ignored: '',
            problems: errMsg,
          },
        ])
      }
      if (featSeq.length % 3 !== 0) {
        const errMsg = `Feature sequence was not divisible by 3 (sequence lenght is ${featSeq.length})`
        this.logger.error(`ERROR - ${errMsg}`)
        await this.checkReportModel.create([
          {
            checkName: 'StopCodonCheckReport',
            ids: [feature._id],
            pass: false,
            ignored: '',
            problems: 'Feature sequence was not divisible by 3!',
          },
        ])
      }
      if (featSeq.length % 3 !== 0 && featSeq.length >= 3) {
        const lastBase = featSeq.slice(-3).toUpperCase()
        if (lastBase !== 'TAA' && lastBase !== 'TAG' && lastBase !== 'TGA') {
          const errMsg = `CDS last base "${lastBase}" is not any not stop codons (TAA, TAG or TGA).`
          this.logger.error(`ERROR - ${errMsg}`)
          await this.checkReportModel.create([
            {
              checkName: 'StopCodonCheckReport',
              ids: [feature._id],
              pass: false,
              ignored: '',
              problems: errMsg,
            },
          ])
        } else {
          const errMsg =
            'ERROR - Feature sequence is less than 3 characters long!'
          this.logger.error(errMsg)
          throw new NotFoundException(errMsg)
        }
      }
      const threeBasesArray = this.splitStringIntoChunks(featSeq, 3)
      // Loop all bases except the last one
      for (let i = 0; i < threeBasesArray.length - 1; i++) {
        const currentItem = threeBasesArray[i].toUpperCase()
        if (
          currentItem === 'TAA' ||
          currentItem === 'TAG' ||
          currentItem === 'TGA'
        ) {
          const errMsg = `Found suspicious stop codon "${currentItem}" inside CDS. The base number is ${
            i + 1
          } (st/nd/rd/th) inside CDSsequence.`
          this.logger.error(`ERROR - ${errMsg}`)
          await this.checkReportModel.create([
            {
              checkName: 'StopCodonCheckReport',
              ids: [feature._id],
              pass: false,
              ignored: '',
              problems: errMsg,
            },
          ])
        }
      }
    }

    // Iterate through children
    if (feature.children) {
      for (const [, child] of feature.children) {
        await this.checkCodon(featureDoc, child, cdsRangesArray)
      }
    }
  }

  splitStringIntoChunks(inputString: string, chunkSize: number): string[] {
    const result: string[] = []
    for (let i = 0; i < inputString.length; i += chunkSize) {
      result.push(inputString.slice(i, i + chunkSize))
    }
    return result
  }

  isOverlap(newStart: number, newEnd: number, ranges: Range[]): boolean {
    for (const range of ranges) {
      // Check for overlap with existing ranges
      if (
        (newStart >= range.start && newStart <= range.end) || // New start overlaps
        (newEnd >= range.start && newEnd <= range.end) || // New end overlaps
        (newStart <= range.start && newEnd >= range.end) // New range completely overlaps an existing range
      ) {
        return true
      }
    }
    return false
  }
}
