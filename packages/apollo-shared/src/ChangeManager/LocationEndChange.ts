import gff, { GFF3Feature, GFF3Item } from '@gmod/gff'
import { resolveIdentifier } from 'mobx-state-tree'

import { AnnotationFeature } from '../BackendDrivers/AnnotationFeature'
import {
  Change,
  ClientDataStore,
  LocalGFF3DataStore,
  SerializedChange,
} from './Change'

interface EndChange {
  featureId: string
  oldEnd: number
  newEnd: number
}

interface SerializedLocationEndChange extends SerializedChange {
  typeName: 'LocationEndChange'
  changes: EndChange[]
}

export class LocationEndChange extends Change {
  changedIds: string[]
  changes: EndChange[]

  constructor(json: SerializedLocationEndChange) {
    super()
    this.changedIds = json.changedIds
    this.changes = json.changes
  }

  get typeName(): 'LocationEndChange' {
    return 'LocationEndChange'
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
    const { changes } = this

    console.debug(`Change request: ${JSON.stringify(changes)}`)
    let gff3ItemString: string | undefined = ''
    const cacheKeys: string[] = await backend.cacheManager.store.keys?.()
    cacheKeys.sort((n1: string, n2: string) => Number(n1) - Number(n2))
    for (const change of changes) {
      // const { featureId, oldEnd, newEnd } = change
      // const searchApolloIdStr = `"apollo_id":["${featureId}"]`

      // Loop the cache content
      for (const lineNumber of cacheKeys) {
        gff3ItemString = await backend.cacheManager.get(lineNumber)
        if (!gff3ItemString) {
          throw new Error(`No cache value found for key ${lineNumber}`)
        }
        const gff3Item = JSON.parse(gff3ItemString) as GFF3Item
        if (Array.isArray(gff3Item)) {
          const updated = this.getUpdatedCacheEntryForFeature(gff3Item, change)
          if (updated) {
            await backend.cacheManager.set(lineNumber, JSON.stringify(gff3Item))
            break
          }
        }
      }
    }
    // Loop the updated cache and write it into file
    const gff3 = await Promise.all(
      cacheKeys.map(async (keyInd): Promise<GFF3Item> => {
        gff3ItemString = await backend.cacheManager.get(keyInd.toString())
        if (!gff3ItemString) {
          throw new Error(`No entry found for ${keyInd.toString()}`)
        }
        return JSON.parse(gff3ItemString)
      }),
    )
    // console.verbose(`Write into file =${JSON.stringify(cacheValue)}, key=${keyInd}`)
    await backend.gff3Handle.writeFile(gff.formatSync(gff3))
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
      feature.location.setEnd(this.changes[idx].newEnd)
    })
  }

  getInverse() {
    const inverseChangedIds = this.changedIds.slice().reverse()
    const inverseChanges = this.changes
      .slice()
      .reverse()
      .map((endChange) => ({
        featureId: endChange.featureId,
        oldEnd: endChange.newEnd,
        newEnd: endChange.oldEnd,
      }))
    return new LocationEndChange({
      changedIds: inverseChangedIds,
      typeName: this.typeName,
      changes: inverseChanges,
    })
  }

  getUpdatedCacheEntryForFeature(
    gff3Feature: GFF3Feature,
    change: EndChange,
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
      const { featureId, newEnd, oldEnd } = change
      if (apolloId === featureId) {
        if (featureLine.end !== oldEnd) {
          throw new Error(
            `Incoming end ${oldEnd} does not match existing end ${featureLine.end}`,
          )
        }
        featureLine.end = newEnd
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
