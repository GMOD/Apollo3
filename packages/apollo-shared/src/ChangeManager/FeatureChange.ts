import { createGunzip } from 'zlib'

import { GFF3Feature, GFF3FeatureLine } from '@gmod/gff'
import { RefSeqDocument } from 'apollo-schemas'
import { v4 as uuidv4 } from 'uuid'

import {
  Change,
  ChangeOptions,
  SerializedChange,
  ServerDataStore,
} from './Change'

interface GFF3FeatureLineWithOptionalRefs extends GFF3FeatureLine {
  // eslint-disable-next-line camelcase
  child_features?: GFF3Feature[]
  // eslint-disable-next-line camelcase
  derived_features?: GFF3Feature[]
}

export interface GFF3FeatureLineWithFeatureIdAndOptionalRefs
  extends GFF3FeatureLineWithOptionalRefs {
  featureId: string
}

export abstract class FeatureChange extends Change {
  logger: import('@nestjs/common').LoggerService
  abstract typeName: string

  static assemblyId: string

  constructor(json: SerializedChange, options?: ChangeOptions) {
    super(json, options)
    const { assemblyId } = json
    this.assemblyId = assemblyId
    this.logger = options?.logger || console
  }

  /**
   * Get single feature by featureId
   * @param featureObject -
   * @param featureId -
   * @returns
   */
  getObjectByFeatureId(
    feature: GFF3FeatureLineWithFeatureIdAndOptionalRefs,
    featureId: string,
  ): GFF3FeatureLineWithFeatureIdAndOptionalRefs | null {
    this.logger.debug?.(`Entry=${JSON.stringify(feature)}`)

    this.logger.debug?.(`Top level featureId=${feature.featureId}`)
    if (feature.featureId === featureId) {
      this.logger.debug?.(
        `Top level featureId matches in object ${JSON.stringify(feature)}`,
      )
      return feature
    }
    // Check if there is also childFeatures in parent feature and it's not empty
    // Let's get featureId from recursive method
    this.logger.debug?.(
      `FeatureId was not found on top level so lets make recursive call...`,
    )
    for (const childFeature of feature.child_features || []) {
      for (const childFeatureLine of childFeature) {
        const subFeature: GFF3FeatureLineWithFeatureIdAndOptionalRefs | null =
          this.getObjectByFeatureId(
            childFeatureLine as GFF3FeatureLineWithFeatureIdAndOptionalRefs,
            featureId,
          )
        if (subFeature) {
          return subFeature
        }
      }
    }
    return null
  }

  async addRefSeqIntoDb(
    fileDocType: string,
    compressedFullFileName: string,
    assemblyId: string,
    backend: ServerDataStore,
  ) {
    const { refSeqModel, refSeqChunkModel, session, fs } = backend
    const { CHUNK_SIZE } = process.env
    const chunkSize = Number(CHUNK_SIZE)
    let chunkIndex = 0
    let refSeqLen = 0
    let refSeqDoc: RefSeqDocument | undefined = undefined
    let fastaInfoStarted = fileDocType !== 'text/x-gff3'

    // Read data from compressed file and parse the content
    const sequenceStream = fs
      .createReadStream(compressedFullFileName)
      .pipe(createGunzip())
    let sequenceBuffer = ''
    let incompleteLine = ''
    let lastLineIsIncomplete = true
    for await (const data of sequenceStream) {
      const chunk = data.toString()
      lastLineIsIncomplete = !chunk.endsWith('\n')
      // chunk is small enough that you can split the whole thing into lines without having to make it into smaller chunks first.
      const lines = chunk.split(/\r?\n/)
      if (incompleteLine) {
        lines[0] = `${incompleteLine}${lines[0]}`
        incompleteLine = ''
      }
      if (lastLineIsIncomplete) {
        incompleteLine = lines.pop() || ''
      }
      for await (const line of lines) {
        // In case of GFF3 file we start to read sequence after '##FASTA' is found
        if (!fastaInfoStarted) {
          if (line.trim() === '##FASTA') {
            fastaInfoStarted = true
          }
          continue
        }
        const refSeqInfoLine = /^>\s*(\S+)\s*(.*)/.exec(line)
        // Add new ref sequence infor if we are reference seq info line
        if (refSeqInfoLine) {
          this.logger.debug?.(
            `Reference sequence information line "${refSeqInfoLine}"`,
          )

          // If there is sequence from previous reference sequence then we need to add it to previous ref seq
          if (sequenceBuffer !== '') {
            if (!refSeqDoc) {
              throw new Error('No refSeq document found')
            }
            refSeqLen += sequenceBuffer.length
            this.logger.debug?.(
              `*** Add the last chunk of previous ref seq ("${refSeqDoc._id}", index ${chunkIndex} and total length for ref seq is ${refSeqLen}): "${sequenceBuffer}"`,
            )
            await refSeqChunkModel.create(
              [
                {
                  refSeq: refSeqDoc._id,
                  n: chunkIndex,
                  sequence: sequenceBuffer,
                },
              ],
              { session },
            )
            sequenceBuffer = ''
          }
          await refSeqDoc?.updateOne({ length: refSeqLen }, { session })
          refSeqLen = 0
          chunkIndex = 0

          const name = refSeqInfoLine[1].trim()
          const description = refSeqInfoLine[2] ? refSeqInfoLine[2].trim() : ''

          const [newRefSeqDoc] = await refSeqModel.create(
            [
              {
                name,
                description,
                assembly: assemblyId,
                length: 0,
                ...(CHUNK_SIZE ? { chunkSize: Number(CHUNK_SIZE) } : null),
              },
            ],
            { session },
          )
          this.logger.debug?.(
            `Added new refSeq "${name}", desc "${description}", docId "${newRefSeqDoc._id}"`,
          )
          refSeqDoc = newRefSeqDoc
        } else if (/\S/.test(line)) {
          if (!refSeqDoc) {
            throw new Error('No refSeq document found')
          }
          sequenceBuffer += line.replace(/\s/g, '')
          // If sequence block > chunk size then save chunk into Mongo
          while (sequenceBuffer.length >= chunkSize) {
            const sequence = sequenceBuffer.slice(0, chunkSize)
            refSeqLen += sequence.length
            this.logger.debug?.(
              `Add chunk (("${refSeqDoc._id}", index ${chunkIndex} and total length ${refSeqLen})): "${sequence}"`,
            )
            await refSeqChunkModel.create(
              [
                {
                  refSeq: refSeqDoc._id,
                  n: chunkIndex,
                  sequence,
                },
              ],
              { session },
            )
            chunkIndex++
            // Set remaining sequence
            sequenceBuffer = sequenceBuffer.slice(chunkSize)
            this.logger.debug?.(`Remaining sequence: "${sequenceBuffer}"`)
          }
        }
      }
    }

    if (sequenceBuffer || lastLineIsIncomplete) {
      if (!refSeqDoc) {
        throw new Error('No refSeq document found')
      }
      // If the file did not end with line break so the last line is incomplete
      if (lastLineIsIncomplete) {
        sequenceBuffer += incompleteLine
      }
      refSeqLen += sequenceBuffer.length
      this.logger.debug?.(
        `*** Add the very last chunk to ref seq ("${refSeqDoc._id}", index ${chunkIndex} and total length for ref seq is ${refSeqLen}): "${sequenceBuffer}"`,
      )
      await refSeqChunkModel.create(
        [
          {
            refSeq: refSeqDoc._id,
            n: chunkIndex,
            sequence: sequenceBuffer,
          },
        ],
        { session },
      )
      await refSeqDoc.updateOne({ length: refSeqLen }, { session })
    }
  }

  async addFeatureIntoDb(gff3Feature: GFF3Feature, backend: ServerDataStore) {
    const { featureModel, refSeqModel, session } = backend
    const { assemblyId } = this

    for (const featureLine of gff3Feature) {
      const refName = featureLine.seq_id
      if (!refName) {
        throw new Error(
          `Valid seq_id not found in feature ${JSON.stringify(featureLine)}`,
        )
      }
      const refSeqDoc = await refSeqModel
        .findOne({ assembly: assemblyId, name: refName })
        .session(session)
        .exec()
      if (!refSeqDoc) {
        throw new Error(
          `RefSeq was not found by assemblyId "${assemblyId}" and seq_id "${refName}" not found`,
        )
      }
      // Let's add featureId to parent feature
      const featureId = uuidv4()
      const featureIds = [featureId]
      this.logger.verbose?.(
        `Added new FeatureId: value=${JSON.stringify(featureLine)}`,
      )

      // Let's add featureId to each child recursively
      const newFeatureLine = this.setAndGetFeatureIdRecursively(
        { ...featureLine, featureId },
        featureIds,
      )
      this.logger.verbose?.(`So far apollo ids are: ${featureIds.toString()}\n`)

      // Add into Mongo
      const [newFeatureDoc] = await featureModel.create(
        [
          {
            refSeq: refSeqDoc._id,
            featureIds,
            ...newFeatureLine,
          },
        ],
        { session },
      )
      this.logger.verbose?.(`Added docId "${newFeatureDoc._id}"`)
    }
  }

  /**
   * Loop child features in parent feature and add featureId to each child's attribute
   * @param parentFeature - Parent feature
   */
  setAndGetFeatureIdRecursively(
    parentFeature: GFF3FeatureLineWithFeatureIdAndOptionalRefs,
    featureIdArrAsParam: string[],
  ): GFF3FeatureLineWithFeatureIdAndOptionalRefs {
    if (parentFeature.child_features?.length === 0) {
      delete parentFeature.child_features
    }
    if (parentFeature.derived_features?.length === 0) {
      delete parentFeature.derived_features
    }
    // If there are child features
    if (parentFeature.child_features) {
      parentFeature.child_features = parentFeature.child_features.map(
        (childFeature) =>
          childFeature.map((childFeatureLine) => {
            const featureId = uuidv4()
            featureIdArrAsParam.push(featureId)
            const newChildFeature = { ...childFeatureLine, featureId }
            this.setAndGetFeatureIdRecursively(
              newChildFeature,
              featureIdArrAsParam,
            )
            return newChildFeature
          }),
      )
    }
    return parentFeature
  }
}
