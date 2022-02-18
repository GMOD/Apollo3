// import * as fs from 'fs'
// import { join } from 'path'
import * as fs from 'fs/promises'
import gff from '@gmod/gff'
import { Cache } from 'cache-manager'
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

  async applyToLocalGFF3(backend: LocalGFF3DataStore) {
    const change = LocationEndChange.fromJSON(backend.serializedChange)

    // To get rid of 'unknown'
    const newObject = JSON.parse(
      JSON.stringify(backend.serializedChange.changes),
    )
    const keyArray = Object.keys(newObject[0])

    // throw new Error(
    //   `newObject=${JSON.stringify(newObject)}, tmp3=${newObject[0].hasOwnProperty('featureId')}, keyarray=${keyArray}, featureId=${newObject[0].featureId}, oldEnd=${newObject[0].oldEnd}`,
    // )

    // **** TODO: UPDATE ALL CHANGES - NOW UPDATING ONLY THE FIRST CHANGE IN 'CHANGES' -ARRAY ****//
    // this.logger.debug(`Change request=${JSON.stringify(serializedChange)}`)
    let cacheValue: string | undefined = ''
    const nberOfEntries = await backend.cacheManager.store.keys?.()
    await nberOfEntries.sort((n1: number, n2: number) => n1 - n2)
    const { featureId } = newObject[0]
    const { oldEnd } = newObject[0]
    const { newEnd } = newObject[0]
    const searchApolloIdStr = `"apollo_id":["${featureId}"]`

    //     throw new Error(
    //   `newObject=${JSON.stringify(newObject)}, featureId=${featureId}, oldEnd=${oldEnd} and newEnd=${newEnd}`,
    // )

    // Loop the cache content
    for (const keyInd of nberOfEntries) {
      cacheValue = await backend.cacheManager.get(keyInd)
      // this.logger.verbose(`Read line from cache=${cacheValue}=, key=${keyInd}`)
      // Check if apolloId matches
      if (cacheValue?.includes(searchApolloIdStr)) {
        const parsedCache = JSON.parse(cacheValue)
        // Comment, Directive and FASTA -entries are not presented as an array
        if (Array.isArray(parsedCache)) {
          // this.logger.verbose(`KEY=${keyInd} ORIGINAL CACHE VALUE IS ${cacheValue}`)
          for (const [key, val] of Object.entries(parsedCache)) {
            if (val.hasOwnProperty('attributes')) {
              const assignedVal = Object.assign(val)
              // Let's check if found apollo_id matches with one we are updating
              if (
                assignedVal.attributes.hasOwnProperty('apollo_id') &&
                assignedVal.attributes.apollo_id == featureId
              ) {
                // Check if old value matches with expected old value
                if (assignedVal.end != oldEnd) {
                  throw new Error(
                    `Old cache value ${assignedVal.end} does not match with expected old value ${oldEnd}`,
                  )
                }
                // this.logger.debug(`Feature found: ${JSON.stringify(assignedVal)}`)
                assignedVal.end = newEnd
                // this.logger.debug(`Old value ${oldEnd} has now been updated to ${newEnd}`)
                // Save updated JSON object to cache
                await backend.cacheManager.set(
                  keyInd.toString(),
                  JSON.stringify(parsedCache),
                )
                break
              }

              // Check if there is childFeatures in parent feature and it's not empty
              if (
                val.hasOwnProperty('child_features') &&
                Object.keys(assignedVal.child_features).length > 0
              ) {
                // Let's search apollo_id recursively
                this.searchApolloIdRecursively(
                  assignedVal,
                  backend.serializedChange,
                  keyInd.toString(),
                  backend.cacheManager,
                )
              }
            }
          }
        }
      }
    }

    // const { FILE_SEARCH_FOLDER, GFF3_DEFAULT_FILENAME_TO_SAVE } = process.env
    const FILE_SEARCH_FOLDER = './test/data'
    const GFF3_DEFAULT_FILENAME_TO_SAVE  = 'volvox.sort.fasta.gff3.demoSave'
    // if (!FILE_SEARCH_FOLDER) {
    //   throw new Error('No FILE_SEARCH_FOLDER found in .env file')
    // }
    // if (!GFF3_DEFAULT_FILENAME_TO_SAVE) {
    //   throw new Error('No GFF3_DEFAULT_FILENAME_TO_SAVE found in .env file')
    // }
    // Replace old file
    await fs.writeFile(FILE_SEARCH_FOLDER + '/' + GFF3_DEFAULT_FILENAME_TO_SAVE, '' )
    // await fs.writeFile(
    //   join(FILE_SEARCH_FOLDER, GFF3_DEFAULT_FILENAME_TO_SAVE),
    //   '',
    // )
    // Loop the updated cache and write it into file
    for (const keyInd of nberOfEntries) {
      cacheValue = await backend.cacheManager.get(keyInd.toString())
      if (!cacheValue) {
        throw new Error(`No entry found for ${keyInd.toString()}`)
      }
      // this.logger.verbose(`Write into file =${JSON.stringify(cacheValue)}, key=${keyInd}`)
      // Write into file line by line
      // await fs.appendFile(
      //   join(FILE_SEARCH_FOLDER, GFF3_DEFAULT_FILENAME_TO_SAVE),
      //   gff.formatSync(JSON.parse(cacheValue)),
      // )
      await fs.appendFile(FILE_SEARCH_FOLDER + '/' + GFF3_DEFAULT_FILENAME_TO_SAVE, gff.formatSync(JSON.parse(cacheValue)) )
    }
    return ''
  }

  applyToClient(dataStore: ClientDataStore) {
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

  /**
   * Process (search and update) child feature recursively
   * @param parentFeature - Parent feature
   * @param serializedChange - Change object
   * @param keyInd - Cache key index of parent feature
   */
  async searchApolloIdRecursively(
    parentFeature: any,
    serializedChange: SerializedChange,
    keyInd: string,
    cacheManager: Cache,
  ) {
    // To get rid of 'unknown'
    const newObject = JSON.parse(
      JSON.stringify(serializedChange.changes),
    )
    const { featureId } = newObject[0]
    const { oldEnd } = newObject[0]
    const { newEnd } = newObject[0]
    // If there is child features and size is not 0
    if (
      parentFeature.hasOwnProperty('child_features') &&
      Object.keys(parentFeature.child_features).length > 0
    ) {
      // Loop each child feature
      for (
        let i = 0;
        i < Object.keys(parentFeature.child_features).length;
        i++
      ) {
        // this.logger.verbose(
        //   `Child no #${i} has value=${JSON.stringify(
        //     parentFeature.child_features[i][0],
        //   )}`,
        // )
        const assignedVal = Object.assign(parentFeature.child_features[i][0])
        // Let's check apollo_id
        if (
          assignedVal.attributes.hasOwnProperty('apollo_id') &&
          assignedVal.attributes.apollo_id == featureId
        ) {
          // this.logger.verbose(
          //   `OLD END VALUE IS ${assignedVal.end}, NEW VALUE WILL BE ${newEnd}`,
          // )
          // Check if given old value matches with cache old value
          if (assignedVal.end != oldEnd) {
            throw new Error(
              `Old cache value ${assignedVal.end} does not match with expected old value ${oldEnd}`,
            )
          }
          // this.logger.debug(`Feature found: ${JSON.stringify(assignedVal)}`)
          assignedVal.end = newEnd
          // this.logger.debug(
          //   `Old value ${oldEnd} has now been updated to ${newEnd}`,
          // )
        }
        for (const k in assignedVal) {
          if (
            typeof parentFeature[k] == 'object' &&
            parentFeature[k] !== null &&
            parentFeature[k].length !== undefined &&
            parentFeature[k].length > 0
          ) {
            this.searchApolloIdRecursively(
              assignedVal,
              serializedChange,
              keyInd,
              cacheManager,
            )
          }
        }
      }
      await cacheManager.set(keyInd, `[${JSON.stringify(parentFeature)}]`)
    }
  }
}
