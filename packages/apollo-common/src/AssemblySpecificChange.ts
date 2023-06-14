import { GFF3Feature } from '@gmod/gff'
import type { AnnotationFeatureSnapshot } from 'apollo-mst'
import { FileDocument, RefSeqDocument } from 'apollo-schemas'
import ObjectID from 'bson-objectid'

import { Change, ChangeOptions, SerializedChange, isChange } from './Change'
import { ServerDataStore } from './Operation'

export interface SerializedAssemblySpecificChange extends SerializedChange {
  assembly: string
}

export function isAssemblySpecificChange(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  thing: any,
): thing is AssemblySpecificChange {
  return (
    isChange(thing) && (thing as AssemblySpecificChange).assembly !== undefined
  )
}

export abstract class AssemblySpecificChange extends Change {
  assembly: string

  constructor(json: SerializedAssemblySpecificChange, options?: ChangeOptions) {
    super(json, options)
    this.assembly = json.assembly
  }

  async addRefSeqIntoDb(
    fileDoc: FileDocument,
    assembly: string,
    backend: ServerDataStore,
  ) {
    const { logger } = this
    const { filesService, refSeqChunkModel, refSeqModel, user } = backend
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
    logger.debug?.('starting sequence stream')
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
          logger.debug?.(
            `Reference sequence information line "${refSeqInfoLine}"`,
          )

          // If there is sequence from previous reference sequence then we need to add it to previous ref seq
          if (sequenceBuffer !== '') {
            if (!refSeqDoc) {
              throw new Error('No refSeq document found')
            }
            refSeqLen += sequenceBuffer.length
            logger.debug?.(
              `Creating refSeq chunk number ${chunkIndex} of "${refSeqDoc._id}"`,
            )
            // We cannot use Mongo 'session' / transaction here because Mongo has 16 MB limit for transaction
            await refSeqChunkModel.create([
              {
                refSeq: refSeqDoc._id,
                n: chunkIndex,
                sequence: sequenceBuffer,
                user,
                status: -1,
              },
            ])
            sequenceBuffer = ''
          }
          await refSeqDoc?.updateOne({ length: refSeqLen })
          // await refSeqDoc?.updateOne({ length: refSeqLen }, { session })
          refSeqLen = 0
          chunkIndex = 0

          const name = refSeqInfoLine[1].trim()
          const description = refSeqInfoLine[2] ? refSeqInfoLine[2].trim() : ''

          // We cannot use Mongo 'session' / transaction here because Mongo has 16 MB limit for transaction
          const [newRefSeqDoc] = await refSeqModel.create([
            {
              name,
              description,
              assembly,
              length: 0,
              ...(customChunkSize ? { chunkSize: customChunkSize } : null),
              user,
              status: -1,
            },
          ])
          logger.debug?.(
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
            logger.debug?.(
              `Creating refSeq chunk number ${chunkIndex} of "${refSeqDoc._id}"`,
            )
            // We cannot use Mongo 'session' / transaction here because Mongo has 16 MB limit for transaction
            await refSeqChunkModel.create([
              {
                refSeq: refSeqDoc._id,
                n: chunkIndex,
                sequence,
                user,
                status: -1,
              },
            ])
            chunkIndex++
            // Set remaining sequence
            sequenceBuffer = sequenceBuffer.slice(chunkSize)
            logger.debug?.(`Remaining sequence: "${sequenceBuffer}"`)
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
      logger.verbose?.(
        `*** Add the very last chunk to ref seq ("${refSeqDoc._id}", index ${chunkIndex} and total length for ref seq is ${refSeqLen}): "${sequenceBuffer}"`,
      )
      logger.debug?.(
        `Creating refSeq chunk number ${chunkIndex} of "${refSeqDoc._id}"`,
      )
      // We cannot use Mongo 'session' / transaction here because Mongo has 16 MB limit for transaction
      await refSeqChunkModel.create([
        {
          refSeq: refSeqDoc._id,
          n: chunkIndex,
          sequence: sequenceBuffer,
          user,
          status: -1,
        },
      ])
      await refSeqDoc.updateOne({ length: refSeqLen })
    }
  }

  private refSeqCache = new Map<string, RefSeqDocument>()

  async addFeatureIntoDb(gff3Feature: GFF3Feature, backend: ServerDataStore) {
    const { featureModel, refSeqModel, user } = backend
    const { assembly, logger, refSeqCache } = this

    for (const featureLine of gff3Feature) {
      const { seq_id: refName } = featureLine
      if (!refName) {
        throw new Error(
          `Valid seq_id not found in feature ${JSON.stringify(featureLine)}`,
        )
      }
      let refSeqDoc = refSeqCache.get(refName)
      if (!refSeqDoc) {
        refSeqDoc =
          (await refSeqModel.findOne({ assembly, name: refName }).exec()) ||
          undefined
        if (refSeqDoc) {
          refSeqCache.set(refName, refSeqDoc)
        }
      }
      if (!refSeqDoc) {
        throw new Error(
          `RefSeq was not found by assembly "${assembly}" and seq_id "${refName}" not found`,
        )
      }
      // Let's add featureId to parent feature
      const featureIds: string[] = []

      const newFeature = createFeature(gff3Feature, refSeqDoc._id, featureIds)
      logger.debug?.(`So far feature ids are: ${featureIds.toString()}`)
      // Add value to gffId
      newFeature.attributes?._id
        ? (newFeature.gffId = newFeature.attributes?._id.toString())
        : (newFeature.gffId = newFeature._id)
      logger.debug?.(
        `********************* Assembly specific change create ${JSON.stringify(
          newFeature,
        )}`,
      )

      // Add into Mongo
      // We cannot use Mongo 'session' / transaction here because Mongo has 16 MB limit for transaction
      const [newFeatureDoc] = await featureModel.create([
        { allIds: featureIds, ...newFeature, user, status: -1 },
      ])
      logger.verbose?.(`Added docId "${newFeatureDoc._id}"`)
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
    attributes,
    child_features: childFeatures,
    end,
    phase,
    score,
    seq_id: refName,
    source,
    start,
    strand,
    type,
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
    gffId: '',
    refSeq,
    type,
    start,
    end,
  }
  if (gff3Feature.length > 1) {
    feature.discontinuousLocations = gff3Feature.map((f) => {
      const { end: subEnd, phase: locationPhase, start: subStart } = f
      if (subStart === null || subEnd === null) {
        throw new Error(
          `feature does not have start and/or end: ${JSON.stringify(f)}`,
        )
      }
      let parsedPhase: 0 | 1 | 2 | undefined = undefined
      if (locationPhase) {
        if (locationPhase === '0') {
          parsedPhase = 0
        } else if (locationPhase === '1') {
          parsedPhase = 1
        } else if (locationPhase === '2') {
          parsedPhase = 2
        } else {
          throw new Error(`Unknown phase: "${locationPhase}"`)
        }
      }
      return { start: subStart, end: subEnd, phase: parsedPhase }
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
      // Add value to gffId
      child.attributes?._id
        ? (child.gffId = child.attributes?._id.toString())
        : (child.gffId = child._id)
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
            // attrs[key.toLowerCase()] = val
            switch (key) {
              case 'ID':
                attrs._id = val
                break
              case 'Name':
                attrs.gff_name = val
                break
              case 'Alias':
                attrs.gff_alias = val
                break
              case 'Target':
                attrs.gff_target = val
                break
              case 'Gap':
                attrs.gff_gap = val
                break
              case 'Derives_from':
                attrs.gff_derives_from = val
                break
              case 'Note':
                attrs.gff_note = val
                break
              case 'Dbxref':
                attrs.gff_dbxref = val
                break
              case 'Ontology_term':
                const goTerms: string[] = []
                const otherTerms: string[] = []
                val.forEach((v) => {
                  if (v.startsWith('GO:')) {
                    goTerms.push(v)
                  } else {
                    otherTerms.push(v)
                  }
                })
                if (goTerms.length) {
                  attrs['Gene Ontology'] = goTerms
                }
                if (otherTerms.length) {
                  attrs.gff_ontology_term = otherTerms
                }
                break
              case 'Is_circular':
                attrs.gff_is_circular = val
                break
              default:
                attrs[key.toLowerCase()] = val
            }
          }
        }
      })
    }
    feature.attributes = attrs
  }
  return feature
}
