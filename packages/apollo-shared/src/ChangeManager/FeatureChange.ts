import { GFF3Feature } from '@gmod/gff'
import type { AnnotationFeatureSnapshot } from 'apollo-mst'
import { Feature, FileDocument, RefSeqDocument } from 'apollo-schemas'
import ObjectID from 'bson-objectid'

import { Change, ServerDataStore } from './Change'

export abstract class FeatureChange extends Change {
  /**
   * Get single feature by featureId
   * @param feature -
   * @param featureId -
   * @returns
   */
  getFeatureFromId(feature: Feature, featureId: string): Feature | null {
    this.logger.verbose?.(`Entry=${JSON.stringify(feature)}`)

    if (feature._id.equals(featureId)) {
      this.logger.debug?.(
        `Top level featureId matches in the object ${JSON.stringify(feature)}`,
      )
      return feature
    }
    // Check if there is also childFeatures in parent feature and it's not empty
    // Let's get featureId from recursive method
    this.logger.debug?.(
      `FeatureId was not found on top level so lets make recursive call...`,
    )
    for (const [, childFeature] of feature.children || new Map()) {
      const subFeature = this.getFeatureFromId(childFeature, featureId)
      if (subFeature) {
        return subFeature
      }
    }
    return null
  }

  async addRefSeqIntoDb(
    fileDoc: FileDocument,
    assemblyId: string,
    backend: ServerDataStore,
  ) {
    const { refSeqModel, refSeqChunkModel, session, filesService } = backend
    const { CHUNK_SIZE } = process.env
    const customChunkSize = CHUNK_SIZE && Number(CHUNK_SIZE)
    let chunkIndex = 0
    let refSeqLen = 0
    let refSeqDoc: RefSeqDocument | undefined = undefined
    let fastaInfoStarted = fileDoc.type !== 'text/x-gff3'

    // Read data from compressed file and parse the content
    const sequenceStream = filesService.getFileStream(fileDoc)
    let sequenceBuffer = ''
    let incompleteLine = ''
    let lastLineIsIncomplete = true
    let parsingStarted = false
    this.logger.log('starting sequence stream')
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
          parsingStarted = true
          this.logger.debug?.(
            `Reference sequence information line "${refSeqInfoLine}"`,
          )

          // If there is sequence from previous reference sequence then we need to add it to previous ref seq
          if (sequenceBuffer !== '') {
            if (!refSeqDoc) {
              throw new Error('No refSeq document found')
            }
            refSeqLen += sequenceBuffer.length
            // this.logger.debug?.(
            //   `*** Add the last chunk of previous ref seq ("${refSeqDoc._id}", index ${chunkIndex} and total length for ref seq is ${refSeqLen})`,
            // )
            this.logger.debug?.(
              `Creating refSeq chunk number ${chunkIndex} of "${refSeqDoc._id}"`,
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
                ...(customChunkSize ? { chunkSize: customChunkSize } : null),
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
          const { chunkSize } = refSeqDoc
          sequenceBuffer += line.replace(/\s/g, '')
          // If sequence block > chunk size then save chunk into Mongo
          while (sequenceBuffer.length >= chunkSize) {
            const sequence = sequenceBuffer.slice(0, chunkSize)
            refSeqLen += sequence.length
            // this.logger.debug?.(
            //   `Add chunk (("${refSeqDoc._id}", index ${chunkIndex} and total length ${refSeqLen})): "${sequence}"`,
            // )
            this.logger.debug?.(
              `Creating refSeq chunk number ${chunkIndex} of "${refSeqDoc._id}"`,
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
    if (!parsingStarted) {
      throw new Error('No reference sequences found in file')
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
      // this.logger.debug?.(
      //   `*** Add the very last chunk to ref seq ("${refSeqDoc._id}", index ${chunkIndex} and total length for ref seq is ${refSeqLen}): "${sequenceBuffer}"`,
      // )
      this.logger.debug?.(
        `Creating refSeq chunk number ${chunkIndex} of "${refSeqDoc._id}"`,
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

  private refSeqCache = new Map<string, RefSeqDocument>()

  async addFeatureIntoDb(gff3Feature: GFF3Feature, backend: ServerDataStore) {
    const { featureModel, refSeqModel, session } = backend
    const { assemblyId } = this

    for (const featureLine of gff3Feature) {
      const { seq_id: refName } = featureLine
      if (!refName) {
        throw new Error(
          `Valid seq_id not found in feature ${JSON.stringify(featureLine)}`,
        )
      }
      let refSeqDoc = this.refSeqCache.get(refName)
      if (!refSeqDoc) {
        refSeqDoc =
          (await refSeqModel
            .findOne({ assembly: assemblyId, name: refName })
            .session(session)
            .exec()) || undefined
        if (refSeqDoc) {
          this.refSeqCache.set(refName, refSeqDoc)
        }
      }
      if (!refSeqDoc) {
        throw new Error(
          `RefSeq was not found by assemblyId "${assemblyId}" and seq_id "${refName}" not found`,
        )
      }
      // Let's add featureId to parent feature
      const featureIds: string[] = []

      const newFeature = createFeature(gff3Feature, refSeqDoc._id, featureIds)

      this.logger.verbose?.(`So far feature ids are: ${featureIds.toString()}`)

      // Add into Mongo
      const [newFeatureDoc] = await featureModel.create(
        [{ allIds: featureIds, ...newFeature }],
        { session },
      )
      this.logger.verbose?.(`Added docId "${newFeatureDoc._id}"`)
    }
  }

  /**
   * Get children's feature ids
   * @param feature - parent feature
   * @returns
   */
  getChildFeatureIds(feature: Feature | AnnotationFeatureSnapshot): string[] {
    if (!feature.children) {
      return []
    }
    const featureIds = []
    const children =
      feature.children instanceof Map
        ? feature.children
        : new Map(Object.entries(feature.children))
    for (const [childFeatureId, childFeature] of children || new Map()) {
      featureIds.push(childFeatureId, ...this.getChildFeatureIds(childFeature))
    }
    return featureIds
  }

  /**
   * Recursively assign new IDs to a feature
   * @param feature - Parent feature
   * @param featureIds -
   */
  generateNewIds(
    feature: Feature | AnnotationFeatureSnapshot,
    featureIds: string[],
  ): AnnotationFeatureSnapshot {
    const newId = new ObjectID().toHexString()
    featureIds.push(newId)

    const children: Record<string, AnnotationFeatureSnapshot> = {}
    if (feature.children) {
      Object.values(feature.children).forEach((child) => {
        const newChild = this.generateNewIds(child, featureIds)
        children[newChild._id] = newChild
      })
    }
    const refSeq =
      typeof feature.refSeq === 'string'
        ? feature.refSeq
        : (
            feature.refSeq as unknown as import('mongoose').Types.ObjectId
          ).toHexString()

    return {
      ...feature,
      refSeq,
      children: feature.children && children,
      _id: newId,
    }
  }
}

function createFeature(
  gff3Feature: GFF3Feature,
  refSeq: string,
  featureIds?: string[],
): AnnotationFeatureSnapshot {
  const [firstFeature] = gff3Feature
  const {
    seq_id: refName,
    type,
    start,
    end,
    strand,
    score,
    phase,
    child_features: childFeatures,
    source,
    attributes,
  } = firstFeature
  if (!refName) {
    throw new Error(
      `feature does not have seq_id: ${JSON.stringify(firstFeature)}`,
    )
  }
  if (!type) {
    throw new Error(
      `feature does not have type: ${JSON.stringify(firstFeature)}`,
    )
  }
  if (start === null) {
    throw new Error(
      `feature does not have start: ${JSON.stringify(firstFeature)}`,
    )
  }
  if (end === null) {
    throw new Error(
      `feature does not have end: ${JSON.stringify(firstFeature)}`,
    )
  }
  const feature: AnnotationFeatureSnapshot = {
    _id: new ObjectID().toHexString(),
    refSeq,
    type,
    start,
    end,
  }
  if (gff3Feature.length > 1) {
    feature.discontinuousLocations = gff3Feature.map((f) => {
      const { start: subStart, end: subEnd } = f
      if (subStart === null || subEnd === null) {
        throw new Error(
          `feature does not have start and/or end: ${JSON.stringify(f)}`,
        )
      }
      return { start: subStart, end: subEnd }
    })
  }
  if (strand) {
    if (strand === '+') {
      feature.strand = 1
    } else if (strand === '-') {
      feature.strand = -1
    } else {
      throw new Error(`Unknown strand: "${strand}"`)
    }
  }
  if (score !== null) {
    feature.score = score
  }
  if (phase) {
    if (phase === '0') {
      feature.phase = 0
    } else if (phase === '1') {
      feature.phase = 1
    } else if (phase === '2') {
      feature.phase = 2
    } else {
      throw new Error(`Unknown phase: "${phase}"`)
    }
  }
  if (featureIds) {
    featureIds.push(feature._id)
  }
  if (childFeatures && childFeatures.length) {
    const children: Record<string, AnnotationFeatureSnapshot> = {}
    for (const childFeature of childFeatures) {
      const child = createFeature(childFeature, refSeq, featureIds)
      children[child._id] = child
    }
    feature.children = children
  }
  if (source || attributes) {
    const attrs: Record<string, string[]> = {}
    if (source) {
      attrs.source = [source]
    }
    if (attributes) {
      Object.entries(attributes).forEach(([key, val]) => {
        if (val) {
          const newKey = key.toLowerCase()
          if (newKey !== 'parent') {
            attrs[key.toLowerCase()] = val
          }
        }
      })
    }
    feature.attributes = attrs
  }
  return feature
}
