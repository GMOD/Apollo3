import gff, { GFF3Feature, GFF3Item } from '@gmod/gff'
import { resolveIdentifier } from 'mobx-state-tree'

import { AnnotationFeature } from '../BackendDrivers/AnnotationFeature'
import {
  Change,
  ClientDataStore,
  LocalGFF3DataStore,
  SerializedChange,
} from './Change'

interface StartChange {
  featureId: string
  oldStart: number
  newStart: number
}

interface SerializedLocationStartChange extends SerializedChange {
  typeName: 'LocationStartChange'
  changes: StartChange[]
}

export class LocationStartChange extends Change {
  changedIds: string[]
  changes: StartChange[]

  constructor(json: SerializedLocationStartChange) {
    super()
    this.changedIds = json.changedIds
    this.changes = json.changes
  }

  get typeName(): 'LocationStartChange' {
    return 'LocationStartChange'
  }

  toJSON() {
    return {
      changedIds: this.changedIds,
      typeName: this.typeName,
      changes: this.changes,
    }
  }

  /**
   * Applies the required change to cache and overwrites GFF3 file on the server
   * @param backend - parameters from backend
   * @returns
   */
  async applyToLocalGFF3(backend: LocalGFF3DataStore) {
    // const { changes } = this

    // console.debug(`Change request: ${JSON.stringify(changes)}`)
    // let gff3ItemString: string | undefined = ''
    // const cacheKeys: string[] = await backend.cacheManager.store.keys?.()
    // cacheKeys.sort((n1: string, n2: string) => Number(n1) - Number(n2))
    // for (const change of changes) {
    //   // Loop the cache content
    //   for (const lineNumber of cacheKeys) {
    //     gff3ItemString = await backend.cacheManager.get(lineNumber)
    //     if (!gff3ItemString) {
    //       throw new Error(`No cache value found for key ${lineNumber}`)
    //     }
    //     const gff3Item = JSON.parse(gff3ItemString) as GFF3Item
    //     if (Array.isArray(gff3Item)) {
    //       const updated = this.getUpdatedCacheEntryForFeature(gff3Item, change)
    //       if (updated) {
    //         await backend.cacheManager.set(lineNumber, JSON.stringify(gff3Item))
    //         break
    //       }
    //     }
    //   }
    // }
    // // Loop the updated cache and write it into file
    // const gff3 = await Promise.all(
    //   cacheKeys.map(async (keyInd): Promise<GFF3Item> => {
    //     gff3ItemString = await backend.cacheManager.get(keyInd.toString())
    //     if (!gff3ItemString) {
    //       throw new Error(`No entry found for ${keyInd.toString()}`)
    //     }
    //     return JSON.parse(gff3ItemString)
    //   }),
    // )
    // // console.verbose(`Write into file =${JSON.stringify(cacheValue)}, key=${keyInd}`)
    // await backend.gff3Handle.writeFile(gff.formatSync(gff3))
  }

  async applyToClient(dataStore: ClientDataStore) {
    if (!dataStore) {
      throw new Error('No data store')
    }
    this.changedIds.forEach((changedId, idx) => {
      const feature = resolveIdentifier(
        AnnotationFeature,
        dataStore.features,
        changedId,
      )
      if (!feature) {
        throw new Error(`Could not find feature with identifier "${changedId}"`)
      }
      feature.location.setStart(this.changes[idx].newStart)
    })
  }

  getInverse() {
    const inverseChangedIds = this.changedIds.slice().reverse()
    const inverseChanges = this.changes
      .slice()
      .reverse()
      .map((startChange) => ({
        featureId: startChange.featureId,
        oldStart: startChange.newStart,
        newStart: startChange.oldStart,
      }))
    return new LocationStartChange({
      changedIds: inverseChangedIds,
      typeName: this.typeName,
      changes: inverseChanges,
    })
  }

  getUpdatedCacheEntryForFeature(
    gff3Feature: GFF3Feature,
    change: StartChange,
  ): boolean {
    for (const featureLine of gff3Feature) {
      if (
        !(
          'attributes' in featureLine &&
          featureLine.attributes &&
          'apollo_id' in featureLine.attributes &&
          featureLine.attributes.apollo_id
        )
      ) {
        throw new Error(
          `Encountered feature without apollo_id: ${JSON.stringify(
            gff3Feature,
          )}`,
        )
      }
      if (featureLine.attributes.apollo_id.length > 1) {
        throw new Error(
          `Encountered feature with multiple apollo_ids: ${JSON.stringify(
            gff3Feature,
          )}`,
        )
      }
      const [apolloId] = featureLine.attributes.apollo_id
      const { featureId, newStart, oldStart } = change
      if (apolloId === featureId) {
        if (featureLine.start !== oldStart) {
          throw new Error(
            `Incoming start ${oldStart} does not match existing start ${featureLine.start}`,
          )
        }
        featureLine.start = newStart
        return true
      }
      if (featureLine.child_features.length > 0) {
        return featureLine.child_features
          .map((childFeature) =>
            this.getUpdatedCacheEntryForFeature(childFeature, change),
          )
          .some((r) => r)
      }
    }
    return false
  }
}
