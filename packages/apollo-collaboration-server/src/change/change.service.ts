import * as fs from 'fs/promises'
import { join } from 'path'

import gff, { GFF3Feature, GFF3FeatureLine, GFF3Sequence } from '@gmod/gff'
import {
  CACHE_MANAGER,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { Cache } from 'cache-manager'

import {
  Change,
  LocationEndChange,
  SerializedChange,
  changeRegistry,
  LocalGFF3DataStore,
} from '../../../apollo-shared'
import { ChangeObjectTmp } from '../entity/gff3Object.dto'

@Injectable()
export class ChangeService {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}
  private readonly logger = new Logger(ChangeService.name)
  
  /**
   * Update location end value in cache and write full new cache to file
   * @param serializedChange Change object containing information about the requested change
   * @returns
   */
  async changeLocationEnd_Original(serializedChange: ChangeObjectTmp): Promise<string> {
    // **** TODO: UPDATE ALL CHANGES - NOW UPDATING ONLY THE FIRST CHANGE IN 'CHANGES' -ARRAY ****//
    this.logger.debug(`Change request=${JSON.stringify(serializedChange)}`)
    let cacheValue: string | undefined = ''
    const nberOfEntries = await this.cacheManager.store.keys?.()
    await nberOfEntries.sort((n1: number, n2: number) => n1 - n2) 
    const { featureId } = serializedChange.changes[0]
    const { oldEnd } = serializedChange.changes[0]
    const { newEnd } = serializedChange.changes[0]
    const searchApolloIdStr = `"apollo_id":["${featureId}"]`

    // Loop the cache content
    for (const keyInd of nberOfEntries) {
      cacheValue = await this.cacheManager.get(keyInd)
      this.logger.verbose(`Read line from cache=${cacheValue}=, key=${keyInd}`)
      // Check if apolloId matches
      if (cacheValue?.includes(searchApolloIdStr)) {
        const parsedCache = JSON.parse(cacheValue)
        // Comment, Directive and FASTA -entries are not presented as an array
        if (Array.isArray(parsedCache)) {
          this.logger.verbose(
            `KEY=${keyInd} ORIGINAL CACHE VALUE IS ${cacheValue}`,
          )
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
                this.logger.debug(
                  `Feature found: ${JSON.stringify(assignedVal)}`,
                )
                assignedVal.end = newEnd
                this.logger.debug(
                  `Old value ${oldEnd} has now been updated to ${newEnd}`,
                )
                // Save updated JSON object to cache
                await this.cacheManager.set(
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
                  serializedChange,
                  keyInd.toString(),
                )
              }
            }
          }
        }
      }
    }

    const { FILE_SEARCH_FOLDER, GFF3_DEFAULT_FILENAME_TO_SAVE } = process.env
    if (!FILE_SEARCH_FOLDER) {
      throw new Error('No FILE_SEARCH_FOLDER found in .env file')
    }
    if (!GFF3_DEFAULT_FILENAME_TO_SAVE) {
      throw new Error('No GFF3_DEFAULT_FILENAME_TO_SAVE found in .env file')
    }
    // Replace old file
    await fs.writeFile(
      join(FILE_SEARCH_FOLDER, GFF3_DEFAULT_FILENAME_TO_SAVE),
      '',
    )
    // Loop the updated cache and write it into file
    for (const keyInd of nberOfEntries) {
      cacheValue = await this.cacheManager.get(keyInd.toString())
      if (!cacheValue) {
        throw new Error(`No entry found for ${keyInd.toString()}`)
      }
      this.logger.verbose(
        `Write into file =${JSON.stringify(cacheValue)}, key=${keyInd}`,
      )
      // Write into file line by line
      await fs.appendFile(
        join(FILE_SEARCH_FOLDER, GFF3_DEFAULT_FILENAME_TO_SAVE),
        gff.formatSync(JSON.parse(cacheValue)),
      )
    }
    return ''
  }

  /**
   * Process (search and update) child feature recursively
   * @param parentFeature - Parent feature
   * @param serializedChange - Change object
   * @param keyInd - Cache key index of parent feature
   */
  async searchApolloIdRecursively(
    parentFeature: any,
    serializedChange: ChangeObjectTmp,
    keyInd: string,
  ) {
    const { featureId } = serializedChange.changes[0]
    const { newEnd } = serializedChange.changes[0]
    const { oldEnd } = serializedChange.changes[0]
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
        this.logger.verbose(
          `Child no #${i} has value=${JSON.stringify(
            parentFeature.child_features[i][0],
          )}`,
        )
        const assignedVal = Object.assign(parentFeature.child_features[i][0])
        // Let's check apollo_id
        if (
          assignedVal.attributes.hasOwnProperty('apollo_id') &&
          assignedVal.attributes.apollo_id == featureId
        ) {
          this.logger.verbose(
            `OLD END VALUE IS ${assignedVal.end}, NEW VALUE WILL BE ${newEnd}`,
          )
          // Check if given old value matches with cache old value
          if (assignedVal.end != oldEnd) {
            throw new Error(
              `Old cache value ${assignedVal.end} does not match with expected old value ${oldEnd}`,
            )
          }
          this.logger.debug(`Feature found: ${JSON.stringify(assignedVal)}`)
          assignedVal.end = newEnd
          this.logger.debug(
            `Old value ${oldEnd} has now been updated to ${newEnd}`,
          )
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
            )
          }
        }
      }
      await this.cacheManager.set(keyInd, `[${JSON.stringify(parentFeature)}]`)
    }
  }
}
