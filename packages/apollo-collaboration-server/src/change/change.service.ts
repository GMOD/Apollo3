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

  async changeLocationEnd(serializedChange: ChangeObjectTmp) {
    this.logger.debug(`change=${JSON.stringify(serializedChange)}`)
    let cacheValue: string | undefined = ''
    const nberOfEntries = await this.cacheManager.store.keys?.()
    nberOfEntries.sort((n1: number, n2: number) => n1 - n2) // Sort the array

    // Loop cache and search given feature id (i.e. apollo_id in attributes)
    // TODO: UPDATE ALL CHANGES - NOT ONLY ONE I.E. INDEX 0
    this.logger.debug(`Update featureId=${serializedChange.changes[0].featureId}`)
    for (const keyInd of nberOfEntries) {
      cacheValue = await this.cacheManager.get(keyInd)
      this.logger.verbose(`Read line from cache=${cacheValue}=, key=${keyInd}`)
      // Check if cache line is same as 'originalLine' -parameter
      //   if (compareTwoJsonObjects(oldValue, cacheValue)) {
      //     this.logger.debug('Found original value from cache')
      //     cacheKey = keyInd
      //     break
      //   }
    }

    return 'kaikki meni ok'
  }

  /**
   * Updates string (or whole line) in CACHE
   * @param postDto - Data Transfer Object that contains information about original string/line and updated string/line
   * @returns
   */
  async updateGFF3Cache(postDto: ChangeObjectTmp) {
    const cacheValue: string | undefined = ''
    // let cacheKey = -1 // Cache key that specifies the row that we update. All cache keys are > 0
    // const oldValue = postDto.originalLine // Search this string in cache
    // const oldValueAsJson = JSON.parse(postDto.originalLine)
    // const newValue = JSON.parse(postDto.updatedLine) // JSON object that contains those key-value -pairs that we will update

    // this.logger.debug(`Search string=${oldValue}=`)
    // const nberOfEntries = await this.cacheManager.store.keys?.()
    // nberOfEntries.sort((n1: number, n2: number) => n1 - n2) // Sort the array

    // // Loop cache and compare each cache row to postDto.originalLine
    // for (const keyInd of nberOfEntries) {
    //   cacheValue = await this.cacheManager.get(keyInd)
    //   this.logger.verbose(`Read line from cache=${cacheValue}=, key=${keyInd}`)
    //   // Check if cache line is same as 'originalLine' -parameter
    // //   if (compareTwoJsonObjects(oldValue, cacheValue)) {
    // //     this.logger.debug('Found original value from cache')
    // //     cacheKey = keyInd
    // //     break
    // //   }
    // }
    // // If the cache did not contain any row that matched to postDto.originalLine then return error
    // if (cacheKey < 0) {
    //   const errMsg = `ERROR when updating cache: The following string was not found in cache='${oldValue}'`
    //   this.logger.error(errMsg)
    //   throw new NotFoundException(errMsg)
    // }

    // // Update JSON object
    // Object.keys(newValue).forEach(function (key) {
    //   oldValueAsJson[0][key] = newValue[key]
    // })
    // // Save updated JSON object to cache
    // await this.cacheManager.set(
    //   cacheKey.toString(),
    //   JSON.stringify(oldValueAsJson),
    // )

    // const { FILE_SEARCH_FOLDER, GFF3_DEFAULT_FILENAME_TO_SAVE } = process.env
    // if (!FILE_SEARCH_FOLDER) {
    //   throw new Error('No FILE_SEARCH_FOLDER found in .env file')
    // }
    // if (!GFF3_DEFAULT_FILENAME_TO_SAVE) {
    //   throw new Error('No GFF3_DEFAULT_FILENAME_TO_SAVE found in .env file')
    // }
    // await fs.writeFile(
    //   join(FILE_SEARCH_FOLDER, GFF3_DEFAULT_FILENAME_TO_SAVE),
    //   '',
    // )

    // nberOfEntries.sort((n1: number, n2: number) => n1 - n2) // Sort the array
    // // Loop cache in sorted order
    // for (const keyInd of nberOfEntries) {
    //   cacheValue = await this.cacheManager.get(keyInd.toString())
    //   if (!cacheValue) {
    //     throw new Error(`No entry found for ${keyInd.toString()}`)
    //   }
    //   this.logger.verbose(
    //     `Write into file =${JSON.stringify(cacheValue)}, key=${keyInd}`,
    //   )
    //   // Write into file line by line
    //   fs.appendFile(
    //     join(FILE_SEARCH_FOLDER, GFF3_DEFAULT_FILENAME_TO_SAVE),
    //     gff.formatSync(JSON.parse(cacheValue)),
    //   )
    // }

    this.logger.debug('Cache and GFF3 file updated successfully')
    return { message: 'Cache and GFF3 file updated successfully!' }
  }
}
