/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import {
  ChangeOptions,
  ClientDataStore,
  FeatureChange,
  LocalGFF3DataStore,
  SerializedFeatureChange,
  ServerDataStore,
} from '@apollo-annotation/common'
import { AnnotationFeatureSnapshot } from '@apollo-annotation/mst'
import { AddFeatureChange } from './AddFeatureChange'
import { Feature, FeatureDocument } from '@apollo-annotation/schemas'
import { first } from 'rxjs'
import { findAndDeleteChildFeature } from './DeleteFeatureChange'
import ObjectID from 'bson-objectid'

interface SerializedMergeExonsChangeBase extends SerializedFeatureChange {
  typeName: 'MergeExonsChange'
}

export interface MergeExonsChangeDetails {
  firstExon: AnnotationFeatureSnapshot
  secondExon: AnnotationFeatureSnapshot
  parentFeatureId?: string
}

interface SerializedMergeExonsChangeSingle
  extends SerializedMergeExonsChangeBase,
    MergeExonsChangeDetails {}

interface SerializedMergeExonsChangeMultiple
  extends SerializedMergeExonsChangeBase {
  changes: MergeExonsChangeDetails[]
}

export type SerializedMergeExonsChange =
  | SerializedMergeExonsChangeSingle
  | SerializedMergeExonsChangeMultiple

export class MergeExonsChange extends FeatureChange {
  typeName = 'MergeExonsChange' as const
  changes: MergeExonsChangeDetails[]

  constructor(json: SerializedMergeExonsChange, options?: ChangeOptions) {
    super(json, options)
    this.changes = 'changes' in json ? json.changes : [json]
  }

  toJSON(): SerializedMergeExonsChange {
    const { assembly, changedIds, changes, typeName } = this
    if (changes.length === 1) {
      const [{ firstExon, secondExon, parentFeatureId }] = changes

      return {
        typeName,
        changedIds,
        assembly,
        firstExon,
        secondExon,
        parentFeatureId,
      }
    }
    return { typeName, changedIds, assembly, changes }
  }

  async executeOnServer(backend: ServerDataStore) {
    const { featureModel, session } = backend
    const { changes, logger } = this
    console.log(changes)

    for (const change of changes) {
      const { firstExon, secondExon, parentFeatureId } = change
      const topLevelFeature = await featureModel
        .findOne({ allIds: parentFeatureId })
        .session(session)
        .exec()
      if (!topLevelFeature) {
        const errMsg = `*** ERROR: The following featureId was not found in database ='${parentFeatureId}'`
        logger.error(errMsg)
        throw new Error(errMsg)
      }

      const newMin = 105 // Math.min(firstExon.min, secondExon.min)
      const newMax = 170 // Math.max(firstExon.max, secondExon.max)

      // Get tx of these exons
      const txId = this.getParentOfExons(
        topLevelFeature,
        firstExon._id,
        secondExon._id,
      )

      const parentFeature = this.getFeatureFromId(topLevelFeature, txId)
      if (!parentFeature) {
        throw new Error(
          `Could not find feature with ID "${parentFeatureId}" in feature "${topLevelFeature._id}"`,
        )
      }
      if (!parentFeature.children) {
        parentFeature.children = new Map()
      }
      if (!parentFeature.attributes?._id) {
        let { attributes } = parentFeature
        if (!attributes) {
          attributes = {}
        }
        attributes = {
          _id: [parentFeature._id.toString()],
          // eslint-disable-next-line unicorn/prefer-structured-clone
          ...JSON.parse(JSON.stringify(attributes)),
        }
        parentFeature.attributes = attributes
      }
      const _id = new ObjectID().toHexString()
      parentFeature.children.set(_id, {
        allIds: [],
        refSeq: parentFeature.refSeq,
        min: newMin,
        max: newMax,
        type: 'exon',
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        _id,
      })
      // Child features should be sorted for click and drag of gene glyphs to work properly
      parentFeature.children = new Map(
        [...parentFeature.children.entries()].sort(
          (a, b) => a[1].min - b[1].min,
        ),
      )
      topLevelFeature.allIds.push(_id)
      await topLevelFeature.save()

      /* --------------- */

      //   const foundFeature = this.getFeatureFromId(topLevelFeature, firstExon._id)
      //   if (!foundFeature) {
      //     const errMsg = 'ERROR when searching feature by featureId'
      //     logger.error(errMsg)
      //     throw new Error(errMsg)
      //   }
      //   if (firstExon.min > secondExon.min) {
      //     foundFeature.min = secondExon.min
      //   }
      //   if (firstExon.max < secondExon.max) {
      //     foundFeature.max = secondExon.max
      //   }
      //   foundFeature.min = 105
      //   foundFeature.max = 170
      //   // TODO: Copy attributes from second exon to first

      //   const deletedIds = findAndDeleteChildFeature(
      //     topLevelFeature,
      //     secondExon._id,
      //     this,
      //   )
      //   deletedIds.push(secondExon._id)
      //   topLevelFeature.allIds = topLevelFeature.allIds.filter(
      //     (id) => !deletedIds.includes(id),
      //   )
      //   topLevelFeature.markModified('merge') // Mark as modified. Without this save() -method is not updating data in database
      //   await topLevelFeature.save()
    }

    // Find the exons in this tx
    // Create a new exon
    // Delete the original exons
  }

  async executeOnLocalGFF3(_backend: LocalGFF3DataStore) {
    throw new Error('executeOnLocalGFF3 not implemented')
  }

  async executeOnClient(dataStore: ClientDataStore) {
    // Same as executeOnServer but on dataStore
    // You get the tx not the gene

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!dataStore) {
      throw new Error('No data store')
    }

    // for (const [idx, changedId] of this.changedIds.entries()) {
    //   const feature = dataStore.getFeature(changedId)
    //   if (!feature) {
    //     throw new Error(`Could not find feature with identifier "${changedId}"`)
    //   }
    //   const { firstExon, secondExon } = this.changes[idx]
    //   if (firstExon.min > secondExon.min) {
    //     feature.min = secondExon.min
    //   }
    //   if (firstExon.max < secondExon.max) {
    //     feature.max = secondExon.max
    //   }
    //   feature.setMin(105)
    //   feature.setMax(170)
    // }
  }

  getInverse() {
    // To be implemented once we know how to reverse changes
    const { assembly, changedIds, changes, logger } = this
    const inverseChangedIds = [...changedIds].reverse()
    const inverseChanges = [...changes]

    return new AddFeatureChange({
      changedIds: inverseChangedIds,
      typeName: 'AddFeatureChange',
      changes: [],
      assembly,
    })
    //   .reverse()
    //   .map((deleteFeatuerChange) => ({
    //     addedFeature: deleteFeatuerChange.deletedFeature,
    //     parentFeatureId: deleteFeatuerChange.parentFeatureId,
    //   }))
    // logger.debug?.(`INVERSE CHANGE '${JSON.stringify(inverseChanges)}'`)
    // return new AddFeatureChange(
    //   {
    //     changedIds: inverseChangedIds,
    //     typeName: 'AddFeatureChange',
    //     changes: inverseChanges,
    //     assembly,
    //   },
    //   { logger },
    // )
  }

  /** Get the id of the feature containing these two exons */
  getParentOfExons(
    geneDoc: Feature,
    firstExonId: string,
    secondExonId: string,
  ): string {
    if (!geneDoc.children) {
      throw new Error('No child found in feature')
    }
    const childrenIds = [...geneDoc.children.keys()]
    if (
      childrenIds.includes(firstExonId) &&
      childrenIds.includes(secondExonId)
    ) {
      return geneDoc._id.toString()
    }
    for (const childId of childrenIds) {
      const feature = geneDoc.children.get(childId)
      if (feature) {
        return this.getParentOfExons(feature, firstExonId, secondExonId)
      }
    }
    return ''
  }
}
