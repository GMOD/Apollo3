/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import type { AnnotationFeatureSnapshot } from '@apollo-annotation/mst'
import {
  Assembly,
  type AssemblyDocument,
  Change,
  type ChangeDocument,
  Feature,
  type FeatureDocument,
  File,
  type FileDocument,
  RefSeq,
  type RefSeqDocument,
  User,
  type UserDocument,
} from '@apollo-annotation/schemas'
import {
  AddFeatureChange,
  AddFeaturesFromFileChange,
  DeleteFeatureChange,
  DeleteUserChange,
  FeatureAttributeChange,
  LocationEndChange,
  LocationStartChange,
  MergeExonsChange,
  MergeTranscriptsChange,
  SplitExonChange,
  StrandChange,
  TypeChange,
  UndoMergeExonsChange,
  UndoMergeTranscriptsChange,
  UndoSplitExonChange,
  UserChange,
  attributesToRecords,
  changes,
  checkChildFeatureBoundaries,
  findAndDeleteChildFeature,
  gff3ToAnnotationFeature,
  stringifyAttributes,
} from '@apollo-annotation/shared'
import type { GFF3Feature } from '@gmod/gff'
import { Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'

import { CountersService } from '../counters/counters.service.js'
import { FilesService } from '../files/files.service.js'
import { MessagesGateway } from '../messages/messages.gateway.js'
import { PluginsService } from '../plugins/plugins.service.js'

type ChangeHandlers = {
  [K in keyof typeof changes]: (
    change: InstanceType<(typeof changes)[K]>,
    context: { user: string },
  ) => Promise<void>
}

export class ChangeHandlersService implements ChangeHandlers {
  constructor(
    @InjectModel(Feature.name)
    private readonly featureModel: Model<FeatureDocument>,
    @InjectModel(Assembly.name)
    private readonly assemblyModel: Model<AssemblyDocument>,
    @InjectModel(RefSeq.name)
    private readonly refSeqModel: Model<RefSeqDocument>,
    @InjectModel(File.name)
    private readonly fileModel: Model<FileDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Change.name)
    private readonly changeModel: Model<ChangeDocument>,
    private readonly filesService: FilesService,
    private readonly countersService: CountersService,
    private readonly pluginsService: PluginsService,
    private readonly messagesGateway: MessagesGateway,
  ) {}

  private readonly logger = new Logger(ChangeHandlersService.name)

  async AddFeatureChange(change: AddFeatureChange, context: { user: string }) {
    const { assemblyModel, featureModel, refSeqModel } = this
    const { assembly, changes } = change
    const { user } = context

    const assemblyDoc = await assemblyModel.findById(assembly).exec()
    if (!assemblyDoc) {
      const errMsg = `*** ERROR: Assembly with id "${assembly}" not found`
      this.logger.error(errMsg)
      throw new Error(errMsg)
    }

    let featureCnt = 0
    this.logger.debug(`changes: ${JSON.stringify(changes)}`)

    const { INDEXED_IDS } = process.env
    let idsToIndex: string[] | undefined
    if (INDEXED_IDS) {
      idsToIndex = INDEXED_IDS.split(',')
    }

    // Loop the changes
    for (const c of changes) {
      this.logger.debug(`change: ${JSON.stringify(c)}`)
      const { addedFeature, allIds, copyFeature, parentFeatureId } = c
      const { _id, refSeq } = addedFeature
      const refSeqDoc = await refSeqModel.findById(refSeq).exec()
      if (!refSeqDoc) {
        throw new Error(
          `RefSeq was not found by assembly "${assembly}" and seq_id "${refSeq}" not found`,
        )
      }

      // CopyFeature is called from CopyFeature.tsx
      if (copyFeature) {
        const indexedIds = change.getIndexedIds(addedFeature, idsToIndex)
        // Add into Mongo
        const [newFeatureDoc] = await featureModel.create([
          {
            ...addedFeature,
            allIds,
            indexedIds,
            status: -1,
            user,
          } as unknown as Partial<Feature>,
        ])
        if (newFeatureDoc) {
          this.logger.debug(
            `Copied feature, docId "${newFeatureDoc.id}" to assembly "${assembly}"`,
          )
          featureCnt++
        }
      } else {
        const indexedIds = change.getIndexedIds(addedFeature, idsToIndex)
        // Adding new child feature
        if (parentFeatureId) {
          const topLevelFeature = await featureModel
            .findOne({ allIds: parentFeatureId })
            .exec()
          if (!topLevelFeature) {
            throw new Error(
              `Could not find feature with ID "${parentFeatureId}"`,
            )
          }
          const parentFeature = change.getFeatureFromId(
            topLevelFeature,
            parentFeatureId,
          )
          if (!parentFeature) {
            throw new Error(
              `Could not find feature with ID "${parentFeatureId}" in feature "${topLevelFeature.id}"`,
            )
          }
          change.addChild(parentFeature, addedFeature)
          const childIds = change.getChildFeatureIds(addedFeature)
          topLevelFeature.allIds.push(_id, ...childIds)
          if (indexedIds.length > 0 && !topLevelFeature.indexedIds) {
            topLevelFeature.indexedIds = []
          }
          topLevelFeature.indexedIds?.push(...indexedIds)
          await topLevelFeature.save()
        } else {
          const childIds = change.getChildFeatureIds(addedFeature)
          const allIdsV2 = [_id, ...childIds]
          const [newFeatureDoc] = await featureModel.create([
            {
              allIds: allIdsV2,
              indexedIds,
              status: 0,
              ...addedFeature,
            } as unknown as Partial<Feature>,
          ])
          if (newFeatureDoc) {
            this.logger.verbose(`Added docId "${newFeatureDoc.id}"`)
          }
        }
      }
      featureCnt++
    }
    this.logger.debug(`Added ${featureCnt} new feature(s) into database.`)
  }

  async DeleteFeatureChange(change: DeleteFeatureChange) {
    const { featureModel } = this
    const { changes } = change

    const { INDEXED_IDS } = process.env
    let idsToIndex: string[] | undefined
    if (INDEXED_IDS) {
      idsToIndex = INDEXED_IDS.split(',')
    }

    for (const c of changes) {
      const { deletedFeature, parentFeatureId } = c

      const featureDoc = await featureModel
        .findOne({ allIds: deletedFeature._id })
        .exec()
      if (!featureDoc) {
        const errMsg = `*** ERROR: The following featureId was not found in database ='${deletedFeature._id}'`
        this.logger.error(errMsg)
        throw new Error(errMsg)
      }

      if (featureDoc._id.equals(deletedFeature._id)) {
        if (parentFeatureId) {
          throw new Error(
            `Feature "${deletedFeature._id}" is top-level, but received a parent feature ID`,
          )
        }
        await featureModel.findByIdAndDelete(featureDoc._id)
        this.logger.debug(
          `Feature "${deletedFeature._id}" deleted from document "${featureDoc.id}". Whole document deleted.`,
        )
        continue
      }

      const deletedIds = findAndDeleteChildFeature(
        featureDoc,
        deletedFeature._id,
        change,
      )
      deletedIds.push(deletedFeature._id)
      featureDoc.allIds = featureDoc.allIds.filter(
        (id) => !deletedIds.includes(id),
      )
      const indexedIds = change.getIndexedIds(featureDoc, idsToIndex)
      if (featureDoc.indexedIds) {
        if (indexedIds.length > 0) {
          featureDoc.indexedIds = indexedIds
        } else {
          delete featureDoc.indexedIds
        }
      } else {
        if (indexedIds.length > 0) {
          featureDoc.indexedIds = indexedIds
        }
      }
      featureDoc.markModified('children')
      try {
        await featureDoc.save()
      } catch (error) {
        this.logger.debug(`*** FAILED: ${String(error)}`)
        throw error
      }
      this.logger.debug(
        `Feature "${deletedFeature._id}" deleted from document "${featureDoc.id}"`,
      )
    }
  }

  async FeatureAttributeChange(change: FeatureAttributeChange) {
    const { featureModel } = this
    const { changes } = change

    const featuresForChanges: {
      feature: Feature
      topLevelFeature: FeatureDocument
    }[] = []
    for (const c of changes) {
      const { featureId } = c

      const topLevelFeature = await featureModel
        .findOne({ allIds: featureId })
        .exec()

      if (!topLevelFeature) {
        const errMsg = `*** ERROR: The following featureId was not found in database ='${featureId}'`
        this.logger.error(errMsg)
        throw new Error(errMsg)
      }
      this.logger.debug(`*** Feature found: ${JSON.stringify(topLevelFeature)}`)

      const foundFeature = change.getFeatureFromId(topLevelFeature, featureId)
      if (!foundFeature) {
        const errMsg = 'ERROR when searching feature by featureId'
        this.logger.error(errMsg)
        throw new Error(errMsg)
      }
      this.logger.debug(`*** Found feature: ${JSON.stringify(foundFeature)}`)
      featuresForChanges.push({ feature: foundFeature, topLevelFeature })
    }

    const { INDEXED_IDS } = process.env
    let idsToIndex: string[] | undefined
    if (INDEXED_IDS) {
      idsToIndex = INDEXED_IDS.split(',')
    }
    for (const [idx, c] of changes.entries()) {
      const { newAttributes } = c
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const { feature, topLevelFeature } = featuresForChanges[idx]!
      const indexedIdsChanged = idsToIndex?.some(
        (id) => id in newAttributes || id in (feature?.attributes ?? {}),
      )
      feature.attributes = newAttributes
      if (indexedIdsChanged) {
        const indexedIds = change.getIndexedIds(topLevelFeature, idsToIndex)
        topLevelFeature.indexedIds = indexedIds
        topLevelFeature.markModified('indexedIds')
      }
      if (topLevelFeature._id.equals(feature._id)) {
        topLevelFeature.markModified('attributes')
      } else {
        topLevelFeature.markModified('children')
      }

      try {
        await topLevelFeature.save()
      } catch (error) {
        this.logger.debug(`*** FAILED: ${String(error)}`)
        throw error
      }
      this.logger.debug(
        `*** Feature attributes modified (added, edited or deleted), docId: ${JSON.stringify(
          topLevelFeature,
        )}`,
      )
    }
  }

  async LocationEndChange(change: LocationEndChange) {
    const { featureModel } = this
    const { changes } = change
    const topLevelFeatures: FeatureDocument[] = []
    for (const c of changes) {
      const { featureId, oldEnd, newEnd } = c

      let topLevelFeature: FeatureDocument | undefined | null
      let feature: Feature | undefined | null
      for (const tlv of topLevelFeatures) {
        const childFeature = change.getFeatureFromId(tlv, featureId)
        if (childFeature) {
          topLevelFeature = tlv
          feature = childFeature
          break
        }
      }
      if (!topLevelFeature) {
        topLevelFeature = await featureModel
          .findOne({ allIds: featureId })
          .exec()
        if (topLevelFeature) {
          topLevelFeatures.push(topLevelFeature)
        }
      }

      if (!topLevelFeature) {
        const errMsg = `*** ERROR: The following featureId was not found in database ='${featureId}'`
        this.logger.error(errMsg)
        throw new Error(errMsg)
      }
      this.logger.debug(
        `*** TOP level feature found: ${JSON.stringify(topLevelFeature)}`,
      )

      feature ??= change.getFeatureFromId(topLevelFeature, featureId)
      if (!feature) {
        const errMsg = 'ERROR when searching feature by featureId'
        this.logger.error(errMsg)
        throw new Error(errMsg)
      }
      this.logger.debug(`*** Found feature: ${JSON.stringify(feature)}`)
      if (feature.max !== oldEnd) {
        const errMsg = 'Expected previous max does not match'
        this.logger.error(errMsg)
        throw new Error(errMsg)
      }
      feature.max = newEnd
      if (topLevelFeature._id.equals(feature._id)) {
        topLevelFeature.markModified('end')
      } else {
        topLevelFeature.markModified('children')
      }
    }
    // Validate every mutated top-level document in-memory before saving any
    // of them: there is no transaction to roll back a save that would later
    // turn out to violate parent/child bounds.
    for (const tlv of topLevelFeatures) {
      checkChildFeatureBoundaries(tlv)
    }
    for (const tlv of topLevelFeatures) {
      try {
        await tlv.save()
      } catch (error) {
        this.logger.debug(`*** FAILED: ${String(error)}`)
        throw error
      }
    }
  }

  async LocationStartChange(change: LocationStartChange) {
    const { featureModel } = this
    const { changes } = change
    const topLevelFeatures: FeatureDocument[] = []
    for (const c of changes) {
      const { featureId, oldStart, newStart } = c

      let topLevelFeature: FeatureDocument | undefined | null
      let feature: Feature | undefined | null
      for (const tlv of topLevelFeatures) {
        const childFeature = change.getFeatureFromId(tlv, featureId)
        if (childFeature) {
          topLevelFeature = tlv
          feature = childFeature
          break
        }
      }
      if (!topLevelFeature) {
        topLevelFeature = await featureModel
          .findOne({ allIds: featureId })
          .exec()
        if (topLevelFeature) {
          topLevelFeatures.push(topLevelFeature)
        }
      }

      if (!topLevelFeature) {
        const errMsg = `*** ERROR: The following featureId was not found in database ='${featureId}'`
        this.logger.error(errMsg)
        throw new Error(errMsg)
      }
      this.logger.debug(
        `*** TOP level feature found: ${JSON.stringify(topLevelFeature)}`,
      )

      feature ??= change.getFeatureFromId(topLevelFeature, featureId)
      if (!feature) {
        const errMsg = 'ERROR when searching feature by featureId'
        this.logger.error(errMsg)
        throw new Error(errMsg)
      }
      this.logger.debug(`*** Found feature: ${JSON.stringify(feature)}`)
      if (feature.min !== oldStart) {
        const errMsg = 'Expected previous max does not match'
        this.logger.error(errMsg)
        throw new Error(errMsg)
      }
      feature.min = newStart
      if (topLevelFeature._id.equals(feature._id)) {
        topLevelFeature.markModified('start')
      } else {
        topLevelFeature.markModified('children')
      }
    }
    // See LocationEndChange: validate all mutated documents before saving any.
    for (const tlv of topLevelFeatures) {
      checkChildFeatureBoundaries(tlv)
    }
    for (const tlv of topLevelFeatures) {
      try {
        await tlv.save()
      } catch (error) {
        this.logger.debug(`*** FAILED: ${String(error)}`)
        throw error
      }
    }
  }

  async MergeExonsChange(change: MergeExonsChange) {
    const { featureModel } = this
    const { changes } = change
    for (const c of changes) {
      const { firstExon, secondExon } = c
      const topLevelFeature = await featureModel
        .findOne({ allIds: firstExon._id })
        .exec()
      if (!topLevelFeature) {
        const errMsg = `*** ERROR: The following featureId was not found in database ='${firstExon._id}'`
        this.logger.error(errMsg)
        throw new Error(errMsg)
      }
      const mergedExon = change.getFeatureFromId(topLevelFeature, firstExon._id)
      if (!mergedExon) {
        const errMsg = 'ERROR when searching feature by featureId'
        this.logger.error(errMsg)
        throw new Error(errMsg)
      }
      mergedExon.min = Math.min(firstExon.min, secondExon.min)
      mergedExon.max = Math.max(firstExon.max, secondExon.max)

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const mergedAttributes: Record<string, string[]> = mergedExon.attributes
        ? // eslint-disable-next-line unicorn/prefer-structured-clone
          JSON.parse(JSON.stringify(mergedExon.attributes))
        : {}
      mergedAttributes.merged_with = [
        stringifyAttributes(attributesToRecords(secondExon.attributes)),
      ]
      mergedExon.attributes = mergedAttributes

      const deletedIds = findAndDeleteChildFeature(
        topLevelFeature,
        secondExon._id,
        change,
      )
      deletedIds.push(secondExon._id)
      topLevelFeature.allIds = topLevelFeature.allIds.filter(
        (id) => !deletedIds.includes(id),
      )
      await topLevelFeature.save()
    }
  }

  async MergeTranscriptsChange(change: MergeTranscriptsChange) {
    const { featureModel } = this
    const { changes } = change
    for (const c of changes) {
      const { firstTranscript, secondTranscript } = c
      const topLevelFeature = await featureModel
        .findOne({ allIds: firstTranscript._id })
        .exec()
      if (!topLevelFeature) {
        const errMsg = `*** ERROR: The following featureId was not found in database ='${firstTranscript._id}'`
        this.logger.error(errMsg)
        throw new Error(errMsg)
      }
      const mergedTranscript = change.getFeatureFromId(
        topLevelFeature,
        firstTranscript._id,
      )
      if (!mergedTranscript) {
        const errMsg = 'ERROR when searching feature by featureId'
        this.logger.error(errMsg)
        throw new Error(errMsg)
      }
      change.mergeTranscriptsOnServer(mergedTranscript, secondTranscript)
      const deletedIds = findAndDeleteChildFeature(
        topLevelFeature,
        secondTranscript._id,
        change,
      )
      deletedIds.push(secondTranscript._id)
      topLevelFeature.allIds = topLevelFeature.allIds.filter(
        (id) => !deletedIds.includes(id),
      )
      await topLevelFeature.save()
    }
  }

  async SplitExonChange(change: SplitExonChange) {
    const { featureModel } = this
    const { changes } = change
    for (const c of changes) {
      const {
        exonToBeSplit,
        parentFeatureId,
        upstreamCut,
        downstreamCut,
        leftExonId,
        rightExonId,
      } = c
      const topLevelFeature = await featureModel
        .findOne({ allIds: exonToBeSplit._id })
        .exec()
      if (!topLevelFeature) {
        const errMsg = `*** ERROR: The following featureId was not found in database ='${exonToBeSplit._id}'`
        this.logger.error(errMsg)
        throw new Error(errMsg)
      }
      const tx = change.getFeatureFromId(topLevelFeature, parentFeatureId)
      if (!tx?.children) {
        throw new Error(
          'ERROR: There should be at least one child (i.e. the exon to be split)',
        )
      }

      const [leftExon, rightExon] = change.makeSplitExons(
        exonToBeSplit,
        upstreamCut,
        downstreamCut,
        leftExonId,
        rightExonId,
      )

      tx.children.set(leftExon._id, {
        allIds: [],
        ...leftExon,
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        _id: leftExon._id,
      })
      tx.children.set(rightExon._id, {
        allIds: [],
        ...rightExon,
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        _id: rightExon._id,
      })
      tx.children = new Map(
        [...tx.children.entries()].sort((a, b) => a[1].min - b[1].min),
      )

      const deletedIds = findAndDeleteChildFeature(
        topLevelFeature,
        exonToBeSplit._id,
        change,
      )
      deletedIds.push(exonToBeSplit._id)
      topLevelFeature.allIds = topLevelFeature.allIds.filter(
        (id) => !deletedIds.includes(id),
      )
      topLevelFeature.allIds.push(leftExon._id, rightExon._id)
      await topLevelFeature.save()
    }
  }

  async StrandChange(change: StrandChange) {
    const { featureModel } = this
    const { changes } = change
    const featuresForChanges: {
      feature: Feature
      topLevelFeature: FeatureDocument
    }[] = []
    for (const entry of changes) {
      const { featureId, oldStrand } = entry

      const topLevelFeature = await featureModel
        .findOne({ allIds: featureId })
        .exec()

      if (!topLevelFeature) {
        const errMsg = `*** ERROR: The following featureId was not found in database ='${featureId}'`
        this.logger.error(errMsg)
        throw new Error(errMsg)
      }
      this.logger.debug(`*** Feature found: ${JSON.stringify(topLevelFeature)}`)

      const foundFeature = change.getFeatureFromId(topLevelFeature, featureId)
      if (!foundFeature) {
        const errMsg = 'ERROR when searching feature by featureId'
        this.logger.error(errMsg)
        throw new Error(errMsg)
      }
      this.logger.debug(`*** Found feature: ${JSON.stringify(foundFeature)}`)
      if (foundFeature.strand !== oldStrand) {
        const errMsg = `*** ERROR: Feature's current strand "${topLevelFeature.strand}" doesn't match with expected value "${oldStrand}"`
        this.logger.error(errMsg)
        throw new Error(errMsg)
      }
      featuresForChanges.push({ feature: foundFeature, topLevelFeature })
    }

    for (const [idx, c] of changes.entries()) {
      const { newStrand } = c
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const { feature, topLevelFeature } = featuresForChanges[idx]!
      feature.strand = newStrand
      if (topLevelFeature._id.equals(feature._id)) {
        topLevelFeature.markModified('strand')
      } else {
        topLevelFeature.markModified('children')
      }

      try {
        await topLevelFeature.save()
      } catch (error) {
        this.logger.debug(`*** FAILED: ${String(error)}`)
        throw error
      }
      this.logger.debug(
        `*** Object updated in Mongo. New object: ${JSON.stringify(
          topLevelFeature,
        )}`,
      )
    }
  }

  async TypeChange(change: TypeChange) {
    const { featureModel } = this
    const { changes } = change
    const featuresForChanges: {
      feature: Feature
      topLevelFeature: FeatureDocument
    }[] = []
    for (const entry of changes) {
      const { featureId, oldType } = entry

      const topLevelFeature = await featureModel
        .findOne({ allIds: featureId })
        .exec()

      if (!topLevelFeature) {
        const errMsg = `*** ERROR: The following featureId was not found in database ='${featureId}'`
        this.logger.error(errMsg)
        throw new Error(errMsg)
      }
      this.logger.debug(`*** Feature found: ${JSON.stringify(topLevelFeature)}`)

      const foundFeature = change.getFeatureFromId(topLevelFeature, featureId)
      if (!foundFeature) {
        const errMsg = 'ERROR when searching feature by featureId'
        this.logger.error(errMsg)
        throw new Error(errMsg)
      }
      this.logger.debug(`*** Found feature: ${JSON.stringify(foundFeature)}`)
      if (foundFeature.type !== oldType) {
        const errMsg = `*** ERROR: Feature's current type "${topLevelFeature.type}" doesn't match with expected value "${oldType}"`
        this.logger.error(errMsg)
        throw new Error(errMsg)
      }
      featuresForChanges.push({ feature: foundFeature, topLevelFeature })
    }

    for (const [idx, c] of changes.entries()) {
      const { newType } = c
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const { feature, topLevelFeature } = featuresForChanges[idx]!
      feature.type = newType
      if (topLevelFeature._id.equals(feature._id)) {
        topLevelFeature.markModified('type')
      } else {
        topLevelFeature.markModified('children')
      }

      try {
        await topLevelFeature.save()
      } catch (error) {
        this.logger.debug(`*** FAILED: ${String(error)}`)
        throw error
      }
      this.logger.debug(
        `*** Object updated in Mongo. New object: ${JSON.stringify(
          topLevelFeature,
        )}`,
      )
    }
  }

  async UndoMergeExonsChange(change: UndoMergeExonsChange) {
    const { featureModel } = this
    const { changes } = change
    for (const c of changes) {
      const { exonsToRestore, parentFeatureId } = c
      if (exonsToRestore.length !== 2) {
        throw new Error(
          `Expected exactly two exons to restore. Got :${exonsToRestore.length}`,
        )
      }
      const topLevelFeature = await featureModel
        .findOne({ allIds: parentFeatureId })
        .exec()
      if (!topLevelFeature) {
        throw new Error(`Could not find feature with ID "${parentFeatureId}"`)
      }
      const parentFeature = change.getFeatureFromId(
        topLevelFeature,
        parentFeatureId,
      )
      if (!parentFeature) {
        throw new Error(
          `Could not find feature with ID "${parentFeatureId}" in feature "${topLevelFeature._id.toString()}"`,
        )
      }
      parentFeature.children ??= new Map()
      for (const exon of exonsToRestore) {
        change.addChild(parentFeature, exon)
        const childIds = change.getChildFeatureIds(exon)
        topLevelFeature.allIds.push(exon._id, ...childIds)
      }
      await topLevelFeature.save()
    }
  }

  async UndoMergeTranscriptsChange(change: UndoMergeTranscriptsChange) {
    const { featureModel } = this
    const { changes } = change
    for (const c of changes) {
      const { transcriptsToRestore, parentFeatureId } = c
      if (transcriptsToRestore.length !== 2) {
        throw new Error(
          `Expected exactly two transcripts to restore. Got :${transcriptsToRestore.length}`,
        )
      }
      const topLevelFeature = await featureModel
        .findOne({ allIds: parentFeatureId })
        .exec()
      if (!topLevelFeature) {
        throw new Error(`Could not find feature with ID "${parentFeatureId}"`)
      }
      const parentFeature = change.getFeatureFromId(
        topLevelFeature,
        parentFeatureId,
      )
      if (!parentFeature) {
        throw new Error(
          `Could not find feature with ID "${parentFeatureId}" in feature "${topLevelFeature._id.toString()}"`,
        )
      }
      parentFeature.children ??= new Map()
      for (const transcript of transcriptsToRestore) {
        change.addChild(parentFeature, transcript)
        const childIds = change.getChildFeatureIds(transcript)
        topLevelFeature.allIds.push(transcript._id, ...childIds)
      }
      await topLevelFeature.save()
    }
  }

  async UndoSplitExonChange(change: UndoSplitExonChange) {
    const { featureModel } = this
    const { changes } = change
    for (const c of changes) {
      const { exonToRestore, parentFeatureId, idsToDelete } = c
      const topLevelFeature = await featureModel
        .findOne({ allIds: parentFeatureId })
        .exec()
      if (!topLevelFeature) {
        throw new Error(`Could not find feature with ID "${parentFeatureId}"`)
      }
      const parentFeature = change.getFeatureFromId(
        topLevelFeature,
        parentFeatureId,
      )
      if (!parentFeature) {
        throw new Error(
          `Could not find feature with ID "${parentFeatureId}" in feature "${topLevelFeature._id.toString()}"`,
        )
      }
      parentFeature.children ??= new Map()
      change.addChild(parentFeature, exonToRestore)
      const childIds = change.getChildFeatureIds(exonToRestore)
      topLevelFeature.allIds.push(exonToRestore._id, ...childIds)
      topLevelFeature.allIds = topLevelFeature.allIds.filter(
        (id) => !idsToDelete.includes(id),
      )
      idsToDelete.map((id) =>
        findAndDeleteChildFeature(topLevelFeature, id, change),
      )
      await topLevelFeature.save()
    }
  }

  // ── private helpers ──

  private getIndexedIds(
    feature: AnnotationFeatureSnapshot | Feature,
    idsToIndex: string[] | undefined,
  ): string[] {
    const indexedIds: string[] = []
    for (const additionalId of idsToIndex ?? []) {
      const { attributes } = feature
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const idValue: string[] =
        attributes instanceof Map
          ? attributes.get(additionalId)
          : (attributes as Record<string, string[]> | undefined)?.[additionalId]
      if (idValue?.[0]) {
        indexedIds.push(idValue[0])
      }
    }
    if (feature.children) {
      const childrenIterable =
        feature.children instanceof Map
          ? feature.children.values()
          : Object.values(feature.children)
      for (const child of childrenIterable) {
        const childIndexedIds = this.getIndexedIds(child, idsToIndex)
        indexedIds.push(...childIndexedIds)
      }
    }
    return indexedIds
  }

  private getAllIds(feature: AnnotationFeatureSnapshot): string[] {
    const allIds = [feature._id]
    if (feature.children) {
      for (const child of Object.values(feature.children)) {
        allIds.push(...this.getAllIds(child))
      }
    }
    return allIds
  }

  private async removeExistingFeatures(assembly: string): Promise<void> {
    const { featureModel, refSeqModel } = this
    this.logger.debug(`Removing existing features for assembly = ${assembly}`)
    const refSeqs = await refSeqModel.find({ assembly }).exec()
    for (const refSeq of refSeqs) {
      await featureModel.deleteMany({ refSeq: refSeq._id })
    }
  }

  private async addFeatureIntoDb(
    gff3Feature: GFF3Feature,
    assembly: string,
    refSeqCache: Map<string, RefSeqDocument>,
    user: string,
  ): Promise<void> {
    const { INDEXED_IDS } = process.env
    let idsToIndex: string[] | undefined
    if (INDEXED_IDS) {
      idsToIndex = INDEXED_IDS.split(',')
    }
    const { featureModel, refSeqModel } = this
    const [firstFeature] = gff3Feature
    const refName = firstFeature?.seq_id
    if (!refName) {
      throw new Error(
        `Valid seq_id not found in feature ${JSON.stringify(gff3Feature)}`,
      )
    }
    let refSeqDoc = refSeqCache.get(refName)
    if (!refSeqDoc) {
      refSeqDoc =
        (await refSeqModel.findOne({ assembly, name: refName }).exec()) ??
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
    const newFeature = gff3ToAnnotationFeature(
      gff3Feature,
      refSeqDoc._id.toString(),
    )
    const allIds = this.getAllIds(newFeature)
    const indexedIds = this.getIndexedIds(newFeature, idsToIndex)
    await featureModel.create([
      {
        allIds,
        indexedIds,
        ...newFeature,
        user,
        status: -1,
      } as unknown as Partial<Feature>,
    ])
  }

  async DeleteUserChange(change: DeleteUserChange) {
    const { userModel } = this
    const { userId } = change
    const user = await userModel.findOneAndDelete({ _id: userId }).exec()
    if (!user) {
      const errMsg = `*** ERROR: User with id "${userId}" not found`
      this.logger.error(errMsg)
      throw new Error(errMsg)
    }
  }

  async UserChange(change: UserChange) {
    const { userModel } = this
    const { changes, userId } = change
    for (const c of changes) {
      this.logger.debug(`change: ${JSON.stringify(changes)}`)
      const { role } = c
      const user = await userModel.findByIdAndUpdate(userId, { role }).exec()
      if (!user) {
        const errMsg = `*** ERROR: User with id "${userId}" not found`
        this.logger.error(errMsg)
        throw new Error(errMsg)
      }
    }
  }

  async AddFeaturesFromFileChange(
    change: AddFeaturesFromFileChange,
    context: { user: string },
  ) {
    const { fileModel, filesService } = this
    const { assembly, changes, deleteExistingFeatures } = change
    const { user } = context
    if (deleteExistingFeatures) {
      await this.removeExistingFeatures(assembly)
    }
    for (const c of changes) {
      const { fileId, parseOptions } = c
      const { FILE_UPLOAD_FOLDER } = process.env
      if (!FILE_UPLOAD_FOLDER) {
        throw new Error('No FILE_UPLOAD_FOLDER found in .env file')
      }
      const fileDoc = await fileModel.findById(fileId).exec()
      if (!fileDoc) {
        throw new Error(`File "${fileId}" not found in Mongo`)
      }
      this.logger.debug(`FileId "${fileId}", checksum "${fileDoc.checksum}"`)
      let errorCount = 0
      // eslint-disable-next-line unicorn/consistent-function-scoping
      const errorLogger = (error: unknown) => {
        if (errorCount <= 99) {
          this.logger.warn('Error parsing or adding feature')
          this.logger.warn(String(error))
          if (errorCount === 99) {
            this.logger.warn(
              'Reached 100 feature errors, omitting further warnings from log',
            )
          }
        }
        errorCount++
      }
      const refSeqCache = new Map<string, RefSeqDocument>()
      const bufferSize = parseOptions?.bufferSize ?? 10_000
      const strict: boolean = parseOptions?.strict ?? true
      const featureStream = filesService.parseGFF3(
        filesService.getFileStream(fileDoc),
        { bufferSize, errorCallback: strict ? undefined : errorLogger },
      )
      let featureCount = 0
      for await (const gff3Feature of featureStream) {
        try {
          await this.addFeatureIntoDb(gff3Feature, assembly, refSeqCache, user)
        } catch (error) {
          if (strict || featureCount === 0) {
            throw error
          }
          errorLogger(error)
        }
        featureCount++
        if (featureCount % 1000 === 0) {
          this.logger.debug(`Processed ${featureCount} features`)
        }
      }
    }
    this.logger.debug('New features added into database!')
  }
}
