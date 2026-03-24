/* eslint-disable @typescript-eslint/require-await */
import {
  attributesToRecords,
  type localChanges,
  stringifyAttributes,
} from '@apollo-annotation/shared'

import type { ClientDataStoreModel } from './ClientDataStore'

type ChangeHandlers = {
  [K in keyof typeof localChanges]: (
    dataStore: ClientDataStoreModel,
    change: InstanceType<(typeof localChanges)[K]>,
  ) => Promise<void>
}

export function isLocalChange(
  changeName: string,
): changeName is keyof typeof localChanges {
  return changeName in changeHandlers
}

export const changeHandlers: ChangeHandlers = {
  async AddFeatureChange(dataStore, change) {
    const { assembly, changes } = change
    for (const c of changes) {
      const { addedFeature, parentFeatureId } = c
      if (parentFeatureId) {
        let parentFeature = dataStore.getFeature(parentFeatureId)
        // maybe the parent feature hasn't been loaded yet
        if (!parentFeature) {
          await dataStore.loadFeatures([
            {
              assemblyName: assembly,
              refName: addedFeature.refSeq,
              start: addedFeature.min,
              end: addedFeature.max,
            },
          ])
          parentFeature = dataStore.getFeature(parentFeatureId)
          if (!parentFeature) {
            throw new Error(
              `Could not find parent feature "${parentFeatureId}"`,
            )
          }
        }
        // create an ID for the parent feature if it does not have one
        if (!parentFeature.attributes.get('_id')) {
          parentFeature.setAttribute('_id', [parentFeature._id])
        }
        parentFeature.addChild(addedFeature)
      } else {
        dataStore.addFeature(assembly, addedFeature)
      }
    }
  },

  async DeleteFeatureChange(dataStore, change) {
    for (const c of change.changes) {
      const { deletedFeature, parentFeatureId } = c
      if (parentFeatureId) {
        const parentFeature = dataStore.getFeature(parentFeatureId)
        if (!parentFeature) {
          throw new Error(`Could not find parent feature "${parentFeatureId}"`)
        }
        parentFeature.deleteChild(deletedFeature._id)
      } else {
        if (dataStore.getFeature(deletedFeature._id)) {
          dataStore.deleteFeature(deletedFeature._id)
        }
      }
    }
  },

  async FeatureAttributeChange(dataStore, change) {
    for (const [idx, changedId] of change.changedIds.entries()) {
      const feature = dataStore.getFeature(changedId)
      if (!feature) {
        throw new Error(`Could not find feature with identifier "${changedId}"`)
      }
      feature.setAttributes(
        new Map(Object.entries(change.changes[idx].newAttributes)),
      )
    }
  },

  async LocationEndChange(dataStore, change) {
    for (const c of change.changes) {
      const { featureId, newEnd } = c
      const feature = dataStore.getFeature(featureId)
      if (!feature) {
        throw new Error(`Could not find feature with identifier "${featureId}"`)
      }
      feature.setMax(newEnd)
    }
  },

  async LocationStartChange(dataStore, change) {
    for (const c of change.changes) {
      const { featureId, newStart } = c
      const feature = dataStore.getFeature(featureId)
      if (!feature) {
        throw new Error(`Could not find feature with identifier "${featureId}"`)
      }
      feature.setMin(newStart)
    }
  },

  async MergeExonsChange(dataStore, change) {
    for (const c of change.changes) {
      const { firstExon, secondExon } = c
      const mergedExon = dataStore.getFeature(firstExon._id)
      if (!mergedExon) {
        throw new Error(
          `Could not find feature with identifier "${firstExon._id}"`,
        )
      }
      mergedExon.setMin(Math.min(firstExon.min, secondExon.min))
      mergedExon.setMax(Math.max(firstExon.max, secondExon.max))

      const mrg = mergedExon.attributes.get('merged_with')?.slice() ?? []
      const mergedWith = stringifyAttributes(
        attributesToRecords(secondExon.attributes),
      )
      if (!mrg.includes(mergedWith)) {
        mrg.push(mergedWith)
      }
      mergedExon.setAttribute('merged_with', mrg)

      mergedExon.parent?.deleteChild(secondExon._id)
    }
  },

  async SplitExonChange(dataStore, change) {
    for (const [idx] of change.changedIds.entries()) {
      const {
        exonToBeSplit,
        parentFeatureId,
        upstreamCut,
        downstreamCut,
        leftExonId,
        rightExonId,
      } = change.changes[idx]
      if (!parentFeatureId) {
        throw new Error('TODO: Split exon without parent')
      }

      const [leftExon, rightExon] = change.makeSplitExons(
        exonToBeSplit,
        upstreamCut,
        downstreamCut,
        leftExonId,
        rightExonId,
      )

      const parentFeature = dataStore.getFeature(parentFeatureId)
      if (!parentFeature) {
        throw new Error(`Could not find parent feature "${parentFeatureId}"`)
      }

      parentFeature.addChild(leftExon)
      parentFeature.addChild(rightExon)
      if (dataStore.getFeature(exonToBeSplit._id)) {
        dataStore.deleteFeature(exonToBeSplit._id)
      }
    }
  },

  async MergeTranscriptsChange(dataStore, change) {
    for (const [idx, changedId] of change.changedIds.entries()) {
      const { firstTranscript, secondTranscript } = change.changes[idx]
      const mergedTranscript = dataStore.getFeature(firstTranscript._id)
      if (!mergedTranscript) {
        throw new Error(`Could not find feature with identifier "${changedId}"`)
      }
      change.mergeTranscriptsOnClient(mergedTranscript, secondTranscript)
      mergedTranscript.parent?.deleteChild(secondTranscript._id)
    }
  },

  async UndoMergeExonsChange(dataStore, change) {
    for (const c of change.changes) {
      const { exonsToRestore, parentFeatureId } = c
      if (!parentFeatureId) {
        throw new Error('Parent ID is missing')
      }
      const parentFeature = dataStore.getFeature(parentFeatureId)
      if (!parentFeature) {
        throw new Error(`Could not find parent feature "${parentFeatureId}"`)
      }
      // create an ID for the parent feature if it does not have one
      if (!parentFeature.attributes.get('_id')) {
        parentFeature.setAttribute('_id', [parentFeature._id])
      }
      for (const exon of exonsToRestore) {
        parentFeature.addChild(exon)
      }
    }
  },

  async UndoSplitExonChange(dataStore, change) {
    for (const c of change.changes) {
      const { exonToRestore, parentFeatureId, idsToDelete } = c
      if (!parentFeatureId) {
        throw new Error('Parent ID is missing')
      }
      const parentFeature = dataStore.getFeature(parentFeatureId)
      if (!parentFeature) {
        throw new Error(`Could not find parent feature "${parentFeatureId}"`)
      }
      // create an ID for the parent feature if it does not have one
      if (!parentFeature.attributes.get('_id')) {
        parentFeature.setAttribute('_id', [parentFeature._id])
      }
      parentFeature.addChild(exonToRestore)
      idsToDelete.map((id) => {
        parentFeature.deleteChild(id)
      })
    }
  },

  async UndoMergeTranscriptsChange(dataStore, change) {
    for (const c of change.changes) {
      const { transcriptsToRestore, parentFeatureId } = c
      if (!parentFeatureId) {
        throw new Error('Parent ID is missing')
      }
      const parentFeature = dataStore.getFeature(parentFeatureId)
      if (!parentFeature) {
        throw new Error(`Could not find parent feature "${parentFeatureId}"`)
      }
      // create an ID for the parent feature if it does not have one
      if (!parentFeature.attributes.get('_id')) {
        parentFeature.setAttribute('_id', [parentFeature._id])
      }
      for (const transcript of transcriptsToRestore) {
        parentFeature.addChild(transcript)
      }
    }
  },

  async StrandChange(dataStore, change) {
    for (const [idx, changedId] of change.changedIds.entries()) {
      const feature = dataStore.getFeature(changedId)
      if (!feature) {
        throw new Error(`Could not find feature with identifier "${changedId}"`)
      }
      feature.setStrand(change.changes[idx].newStrand)
    }
  },

  async TypeChange(dataStore, change) {
    for (const [idx, changedId] of change.changedIds.entries()) {
      const feature = dataStore.getFeature(changedId)
      if (!feature) {
        throw new Error(`Could not find feature with identifier "${changedId}"`)
      }
      feature.setType(change.changes[idx].newType)
    }
  },
}
