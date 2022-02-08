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
} from '../../../apollo-shared'
import { ChangeObjectTmp } from '../entity/gff3Object.dto'

@Injectable()
export class ChangeService {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}
  private readonly logger = new Logger(ChangeService.name)

  async changeLocationEnd(serializedChange: ChangeObjectTmp): Promise<string> {
    this.logger.debug(`change=${JSON.stringify(serializedChange)}`)
    let cacheValue: string | undefined = ''
    const nberOfEntries = await this.cacheManager.store.keys?.()
    await nberOfEntries.sort((n1: number, n2: number) => n1 - n2) // Sort the array
    const { featureId } = serializedChange.changes[0]
    const { newEnd } = serializedChange.changes[0]
    const searchApolloIdStr = `"apollo_id":["${featureId}"]`
    let dataIsUpdated = false

    // TODO: UPDATE ALL CHANGES - NOT ONLY ONE I.E. INDEX 0
    this.logger.debug(`Update featureId=${featureId}`)
    // Loop the cache content
    for (const keyInd of nberOfEntries) {
      cacheValue = await this.cacheManager.get(keyInd)
      this.logger.verbose(`Read line from cache=${cacheValue}=, key=${keyInd}`)
      // Find apollo_id and check if it matches
      if (cacheValue?.includes(searchApolloIdStr)) {
        const parsedCache = JSON.parse(cacheValue)
        // Comment, Directive and FASTA -entries are not presented as an array
        if (Array.isArray(parsedCache)) {
          this.logger.debug(
            `KEY=${keyInd} ORIGINAL CACHE VALUE IS ${cacheValue}`,
          )
          for (const [key, val] of Object.entries(parsedCache)) {
            this.logger.verbose(
              `GFF3Item: key=${JSON.stringify(key)}, value=${JSON.stringify(
                val,
              )}`,
            )
            if (val.hasOwnProperty('attributes')) {
              const assignedVal = Object.assign(val)
              // Let's check apollo_id
              if (
                assignedVal.attributes.hasOwnProperty('apollo_id') &&
                assignedVal.attributes.apollo_id == featureId
              ) {
                this.logger.debug(
                  `OLD END VALUE IS ${assignedVal.end}, NEW VALUE WILL BE ${newEnd}`,
                )
                assignedVal.end = newEnd
                this.logger.debug(
                  `NEW CACHE VALUE IS ${JSON.stringify(parsedCache)}`,
                )
                // cacheValue
                // Save updated JSON object to cache
                await this.cacheManager.set(
                  keyInd.toString(),
                  JSON.stringify(parsedCache),
                )
                dataIsUpdated = true
              }

              // Check if there is also childFeatures in parent feature and it's not empty
              if (
                val.hasOwnProperty('child_features') &&
                Object.keys(assignedVal.child_features).length > 0
              ) {
                this.logger.verbose(
                  `Size of 1st level child features=${
                    Object.keys(assignedVal.child_features).length
                  }`,
                )
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

    // if (dataIsUpdated) {
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
    // Data is updated so we need to write new data into file
    // nberOfEntries = await this.cacheManager.store.keys?.()
    await nberOfEntries.sort((n1: number, n2: number) => n1 - n2) // Sort the array
    for (const keyInd of nberOfEntries) {
      cacheValue = await this.cacheManager.get(keyInd.toString())
      this.logger.debug(`KEY=${keyInd.toString()}, VALUE=${JSON.stringify(cacheValue).substring(0,20)}`)
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
    // }
    return 'No data found'
  }

  /**
   * Loop child features in parent feature and add apollo_id to each child
   */
  async searchApolloIdRecursively(
    obj: any,
    serializedChange: ChangeObjectTmp,
    keyInd: string,
  ) {
    const { featureId } = serializedChange.changes[0]
    const { newEnd } = serializedChange.changes[0]
    // If there is child features and size is not 0
    if (
      obj.hasOwnProperty('child_features') &&
      Object.keys(obj.child_features).length > 0
    ) {
      // Loop each child feature
      for (let i = 0; i < Object.keys(obj.child_features).length; i++) {
        this.logger.verbose(
          `Child no #${i} has value=${JSON.stringify(
            obj.child_features[i][0],
          )}`,
        )
        const assignedVal = Object.assign(obj.child_features[i][0])
        // Let's check apollo_id
        if (
          assignedVal.attributes.hasOwnProperty('apollo_id') &&
          assignedVal.attributes.apollo_id == featureId
        ) {
          this.logger.debug(
            `OLD END VALUE IS ${assignedVal.end}, NEW VALUE WILL BE ${newEnd}`,
          )
          this.logger.debug(`ORIGINAL = ${JSON.stringify(obj)}`)
          // this.logger.debug(
          //   `RECURSIIVISESTI LOYTYI PAIVITETTAVA APOLLO_ID=${assignedVal.attributes.apollo_id}`,
          // )
          assignedVal.end = newEnd
          // obj.child_features[i][0] = assignedVal
          //* **
          this.logger.debug(`KEY=${keyInd} UPDATED = ${JSON.stringify(obj)}`)
        }
        for (const k in assignedVal) {
          if (
            typeof obj[k] == 'object' &&
            obj[k] !== null &&
            obj[k].length !== undefined &&
            obj[k].length > 0
          ) {
            this.searchApolloIdRecursively(
              assignedVal,
              serializedChange,
              keyInd,
            )
          }
        }
      }
      // Save updated JSON object to cache
      // const tmp = await this.cacheManager.get('197')
      // this.logger.debug(`Cachesta = ${tmp}`)
      // this.logger.debug(`obj = ${JSON.stringify(obj)}}`)
      const valid = '[' + `${JSON.stringify(obj)}` + ']'
      this.logger.debug(`valid = ${valid}}`)
      await this.cacheManager.set(keyInd, valid)
      //* ** */
    }
  }
}
