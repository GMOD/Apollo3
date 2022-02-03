import { existsSync } from 'fs'
import * as fs from 'fs/promises'
import { join } from 'path'

import gff, { GFF3Feature, GFF3FeatureLine, GFF3Sequence } from '@gmod/gff'
import {
  CACHE_MANAGER,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { Cache } from 'cache-manager'

import {
  FastaSequenceInfo,
  GFF3ChangeLineObjectDto,
} from '../entity/gff3Object.dto'
import {
  compareTwoJsonObjects,
  getCurrentDateTime,
  writeIntoGff3ChangeLog,
} from '../utils/commonUtilities'
import {v4 as uuidv4} from 'uuid';

@Injectable()
export class FileHandlingService {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}
  private readonly logger = new Logger(FileHandlingService.name)

  /**
   * Save new uploaded file into local filesystem. The filename in local filesystem will be: 'uploaded' + timestamp in ddmmyyyy_hh24miss -format + original filename
   * @param newUser - New user information
   * @returns Return 'HttpStatus.OK' if save was successful
   * or in case of error return error message with 'HttpStatus.INTERNAL_SERVER_ERROR'
   */
  async saveNewFile(file: Express.Multer.File) {
    // Check if filesize is 0
    if (file.size < 1) {
      const msg = `File ${file.originalname} is empty!`
      this.logger.error(msg)
      throw new InternalServerErrorException(msg)
    }
    this.logger.debug(
      `Starting to save file ${file.originalname}, size=${file.size} bytes.`,
    )
    const filenameWithoutPath = `uploaded_${getCurrentDateTime()}_${
      file.originalname
    }`

    // Join path+filename
    const { FILE_SEARCH_FOLDER } = process.env
    if (!FILE_SEARCH_FOLDER) {
      throw new Error('No FILE_SEARCH_FOLDER found in .env file')
    }
    const newFullFileName = join(FILE_SEARCH_FOLDER, filenameWithoutPath)
    this.logger.debug(`New file will be saved as ${newFullFileName}`)

    // Save file
    await fs.writeFile(newFullFileName, file.buffer)
    return filenameWithoutPath
  }

  /**
   * Check if given filename exists in default folder
   * @param filename - New user information
   * @returns Return TRUE if file exists, otherwise return FALSE
   */
  fileExists(filename: string) {
    try {
      // Join path+filename
      const { FILE_SEARCH_FOLDER } = process.env
      if (!FILE_SEARCH_FOLDER) {
        throw new Error('No FILE_SEARCH_FOLDER found in .env file')
      }
      const newFullFileName = join(FILE_SEARCH_FOLDER, filename)
      this.logger.debug(`Check if file ${newFullFileName} exists!`)

      // Check if file exists
      if (existsSync(newFullFileName)) {
        return true
      }
    } catch (err) {
      this.logger.error(`ERROR when checking if file exists: ${err}`)
    }
    return false
  }

  /**
   * Update existing GFF3 file in local filesystem.
   */
  async updateGFF3File(postDto: GFF3ChangeLineObjectDto) {
    // Join path+filename
    const { FILE_SEARCH_FOLDER } = process.env
    if (!FILE_SEARCH_FOLDER) {
      throw new Error('No FILE_SEARCH_FOLDER found in .env file')
    }
    const fullFileName = join(FILE_SEARCH_FOLDER, postDto.filename)

    const oldValue = postDto.originalLine
    const newValue = postDto.updatedLine

    // Read the file
    const data = await fs.readFile(fullFileName, 'utf8')
    // Check that there is at least one occurance of search string in the file
    if (data.indexOf(oldValue) >= 0) {
      const replacer = new RegExp(oldValue, 'g')
      const change = data.replace(replacer, newValue)
      // Write updated content back to file
      await fs.writeFile(fullFileName, change, 'utf8')

      this.logger.debug(`File ${postDto.filename} successfully updated!`)
      return { message: `File ${postDto.filename} successfully updated!` }
    }
    const errMsg = `ERROR when updating file: The following string was not found in GFF3 file='${oldValue}'`
    this.logger.error(errMsg)
    throw new NotFoundException(errMsg)
  }

  /**
   * Loads GFF3 file data into cache. Cache key is started from 0
   * @param filename - File where data is loaded into cache
   * @returns
   */
  async loadGff3IntoCache(filename: string) {
    // Check if file exists
    if (!this.fileExists(filename)) {
      this.logger.error(
        `File =${filename}= does not exist in folder =${process.env.FILE_SEARCH_FOLDER}=`,
      )
      throw new InternalServerErrorException(`File ${filename} does not exist!`)
    }
    // Load GFF3 file into cache
    this.loadGFF3FileIntoCache(filename)

    return { message: 'GFF3 file loaded into cache' }
  }

  /**
   * Updates string (or whole line) in CACHE
   * @param postDto - Data Transfer Object that contains information about original string/line and updated string/line
   * @returns
   */
  async updateGFF3Cache(postDto: GFF3ChangeLineObjectDto) {
    let cacheValue: string | undefined = ''
    let cacheKey = -1 // Cache key that specifies the row that we update. All cache keys are > 0
    const oldValue = postDto.originalLine // Search this string in cache
    const oldValueAsJson = JSON.parse(postDto.originalLine)
    const newValue = JSON.parse(postDto.updatedLine) // JSON object that contains those key-value -pairs that we will update

    this.logger.debug(`Search string=${oldValue}=`)
    const nberOfEntries = await this.cacheManager.store.keys?.()
    nberOfEntries.sort((n1: number, n2: number) => n1 - n2) // Sort the array

    // Loop cache and compare each cache row to postDto.originalLine
    for (const keyInd of nberOfEntries) {
      cacheValue = await this.cacheManager.get(keyInd)
      this.logger.verbose(`Read line from cache=${cacheValue}=, key=${keyInd}`)
      // Check if cache line is same as 'originalLine' -parameter
      if (compareTwoJsonObjects(oldValue, cacheValue)) {
        this.logger.debug('Found original value from cache')
        cacheKey = keyInd
        break
      }
    }
    // If the cache did not contain any row that matched to postDto.originalLine then return error
    if (cacheKey < 0) {
      const errMsg = `ERROR when updating cache: The following string was not found in cache='${oldValue}'`
      this.logger.error(errMsg)
      throw new NotFoundException(errMsg)
    }

    // Update JSON object
    Object.keys(newValue).forEach(function (key) {
      oldValueAsJson[0][key] = newValue[key]
    })
    // Save updated JSON object to cache
    await this.cacheManager.set(
      cacheKey.toString(),
      JSON.stringify(oldValueAsJson),
    )

    const { FILE_SEARCH_FOLDER, GFF3_DEFAULT_FILENAME_TO_SAVE } = process.env
    if (!FILE_SEARCH_FOLDER) {
      throw new Error('No FILE_SEARCH_FOLDER found in .env file')
    }
    if (!GFF3_DEFAULT_FILENAME_TO_SAVE) {
      throw new Error('No GFF3_DEFAULT_FILENAME_TO_SAVE found in .env file')
    }
    await fs.writeFile(
      join(FILE_SEARCH_FOLDER, GFF3_DEFAULT_FILENAME_TO_SAVE),
      '',
    )

    nberOfEntries.sort((n1: number, n2: number) => n1 - n2) // Sort the array
    // Loop cache in sorted order
    for (const keyInd of nberOfEntries) {
      cacheValue = await this.cacheManager.get(keyInd.toString())
      if (!cacheValue) {
        throw new Error(`No entry found for ${keyInd.toString()}`)
      }
      this.logger.verbose(
        `Write into file =${JSON.stringify(cacheValue)}, key=${keyInd}`,
      )
      // Write into file line by line
      fs.appendFile(
        join(FILE_SEARCH_FOLDER, GFF3_DEFAULT_FILENAME_TO_SAVE),
        gff.formatSync(JSON.parse(cacheValue)),
      )
    }
    // Write change -information into separate change log -file
    writeIntoGff3ChangeLog(
      'user xxx', // TODO: DON'T USE HARD CODED VALUES IN PRODUCTION!
      postDto.originalLine,
      postDto.updatedLine,
    )

    this.logger.debug('Cache and GFF3 file updated successfully')
    return { message: 'Cache and GFF3 file updated successfully!' }
  }

  /**
   * Loads GFF3 file into cache
   * @param filename - GFF3 filename where data is loaded
   */
  async loadGFF3FileIntoCache(filename: string) {
    // parse a string of gff3 synchronously
    const { FILE_SEARCH_FOLDER } = process.env
    if (!FILE_SEARCH_FOLDER) {
      throw new Error('No FILE_SEARCH_FOLDER found in .env file')
    }

    this.logger.debug(
      `Starting to load gff3 file ${filename} into cache! Whole path is '${join(
        FILE_SEARCH_FOLDER,
        filename,
      )}'`,
    )

    // This method check that each line has unique id. If not it creates one for each line and overwrites the orignal file
    this.checkGFF3uniqueKey(join(FILE_SEARCH_FOLDER, filename))

    const stringOfGFF3 = await fs.readFile(join(FILE_SEARCH_FOLDER, filename), {
      encoding: 'utf8',
      flag: 'r',
    })
    this.logger.verbose(`Data read from file=${stringOfGFF3}`)
    // Clear old entries from cache
    this.cacheManager.reset()

    const arrayOfThings = gff.parseStringSync(stringOfGFF3, {
      parseAll: true,
    })
    let ind = 0

    // Loop all lines and add those into cache
    for (const entry of arrayOfThings) {
      // Comment, Directive and FASTA -entries are not presented as an array so let's put entry into array because gff.formatSync() -method requires an array as argument
      if (!Array.isArray(entry)) {
        const result = [entry]
        this.cacheManager.set(ind.toString(), JSON.stringify(result))
        this.logger.verbose(
          `Add Comments, Directive or FASTA into cache=${JSON.stringify(
            result,
          )}`,
        )
      } else {
        this.cacheManager.set(ind.toString(), JSON.stringify(entry))
        this.logger.verbose(`Add into cache new entry=${JSON.stringify(entry)}`)
      }
      ind++
    }
    const nberOfEntries = await this.cacheManager.store.keys?.()
    this.logger.debug(`Added ${nberOfEntries.length} entries to cache`)
  }

  /**
   * Fetch features based on Reference seq, Start and End -values
   * @param searchDto - Data Transfer Object that contains information about searchable region
   * @returns Return array of features (as JSON) if search was successful
   * or if search data was not found or in case of error return throw exception
   */
  async getFeaturesByCriteria(searchDto: GFF3FeatureLine) {
    let cacheValue: string | undefined = ''
    let cacheValueAsJson: GFF3Feature
    const resultJsonArray: GFF3FeatureLine[] = [] // Return JSON array

    const nberOfEntries = await this.cacheManager.store.keys?.()

    this.logger.debug(
      `Feature search criteria is seq_id=${searchDto.seq_id}, start=${searchDto.start} and end=${searchDto.end}`,
    )

    if (searchDto.start != null && searchDto.end != null) {
      // Loop cache
      for (const keyInd of nberOfEntries) {
        cacheValue = await this.cacheManager.get(keyInd)
        if (!cacheValue) {
          throw new Error(`No entry found for ${keyInd.toString()}`)
        }
        cacheValueAsJson = JSON.parse(cacheValue)
        this.logger.verbose(
          `Cache SEQ_ID=${cacheValueAsJson[0].seq_id}, START=${cacheValueAsJson[0].start} and END=${cacheValueAsJson[0].end}`,
        )
        // Compare cache values vs. searchable values
        const [value] = cacheValueAsJson
        if (
          value.seq_id === searchDto.seq_id &&
          value.end !== null &&
          value.end > searchDto.start &&
          value.start !== null &&
          value.start < searchDto.end
        ) {
          this.logger.debug(
            `Matched found seq_id=${cacheValueAsJson[0].seq_id}, start=${cacheValueAsJson[0].start} and end=${cacheValueAsJson[0].end}`,
          )
          // Add found feature into array
          resultJsonArray.push(cacheValueAsJson[0])
        }
      }
    }

    // If no feature was found
    if (resultJsonArray.length === 0) {
      const errMsg = 'No features found for given search criteria'
      this.logger.error(errMsg)
      throw new NotFoundException(errMsg)
    }

    this.logger.debug(
      `Features (n=${resultJsonArray.length}) found successfully`,
    )
    return resultJsonArray
  }

  /**
   * Fetch embedded FASTA sequence based on Reference seq, Start and End -values
   * @param searchDto - Data Transfer Object that contains information about searchable sequence
   * @returns Return embedded FASTA sequence if search was successful
   * or if search data was not found or in case of error throw exception
   */
  async getFastaByCriteria(searchDto: GFF3FeatureLine) {
    let cacheValue: string | undefined = ''
    let cacheValueAsJson, keyArray
    const nberOfEntries = await this.cacheManager.store.keys?.()

    this.logger.debug(
      `Fasta search criteria is seq_id=${searchDto.seq_id}, start=${searchDto.start} and end=${searchDto.end}`,
    )

    if (searchDto.start != null && searchDto.end != null) {
      // Loop cache
      for (const keyInd of nberOfEntries) {
        cacheValue = await this.cacheManager.get(keyInd)
        if (!cacheValue) {
          throw new Error(`No entry found for ${keyInd.toString()}`)
        }
        cacheValueAsJson = JSON.parse(cacheValue)
        this.logger.verbose(`Cache seq_id=${cacheValueAsJson[0].id}`)
        keyArray = Object.keys(cacheValueAsJson[0])
        // Compare cache id vs. searchable refName. FASTA sequence object size is three ('id', 'description' and 'sequence')
        if (
          keyArray.length === 3 &&
          cacheValueAsJson[0].hasOwnProperty('id') &&
          cacheValueAsJson[0].hasOwnProperty('description') &&
          cacheValueAsJson[0].hasOwnProperty('sequence') &&
          cacheValueAsJson[0].id === searchDto.seq_id
        ) {
          // Check end position
          if (searchDto.end > cacheValueAsJson[0].sequence.length) {
            const errMsg = `ERROR. Searched FASTA end position ${searchDto.end} is out range. Sequence lenght is only ${cacheValueAsJson[0].sequence.length}`
            this.logger.error(errMsg)
            throw new NotFoundException(errMsg)
          }
          // Check start vs. end positions
          if (searchDto.start >= searchDto.end) {
            const errMsg =
              'ERROR. Start position cannot be greater or equal than end position'
            this.logger.error(errMsg)
            throw new NotFoundException(errMsg)
          }

          const foundSequence = cacheValueAsJson[0].sequence.substring(
            searchDto.start,
            searchDto.end,
          )
          this.logger.debug(
            `Found sequence seq_id=${cacheValueAsJson[0].id} and sequence=${foundSequence}`,
          )
          const resultObject: GFF3Sequence = {
            id: cacheValueAsJson[0].id,
            description: cacheValueAsJson[0].description,
            sequence: foundSequence,
          }
          return resultObject
        }
      }
    }

    throw new NotFoundException(
      `Fasta sequence for criteria seq_id=${searchDto.seq_id}, start=${searchDto.start} and end=${searchDto.end} was not found`,
    )
  }

  /**
   * Get list of embedded FASTA sequences
   * @returns Return list of embedded FASTA sequences as array of fastaSequenceInfo -object
   * or if no data was found or in case of error throw exception
   */
  async getFastaInfo() {
    let cacheValue: string | undefined = ''
    let cacheValueAsJson, keyArray
    const resultJsonArray: FastaSequenceInfo[] = [] // Return JSON array

    const nberOfEntries = await this.cacheManager.store.keys?.()
    this.logger.debug('Get embedded FASTA information')

    // Loop cache
    for (const keyInd of nberOfEntries) {
      cacheValue = await this.cacheManager.get(keyInd)
      if (!cacheValue) {
        throw new Error(`No entry found for ${keyInd.toString()}`)
      }
      cacheValueAsJson = JSON.parse(cacheValue)
      keyArray = Object.keys(cacheValueAsJson[0])
      // FASTA sequence object size is three ('id', 'description' and 'sequence')
      if (
        keyArray.length === 3 &&
        cacheValueAsJson[0].hasOwnProperty('id') &&
        cacheValueAsJson[0].hasOwnProperty('description') &&
        cacheValueAsJson[0].hasOwnProperty('sequence')
      ) {
        const tmpInfoObject: FastaSequenceInfo = {
          refName: cacheValueAsJson[0].id,
          description: cacheValueAsJson[0].description,
          length: cacheValueAsJson[0].sequence.length,
        }
        resultJsonArray.push(tmpInfoObject)
        this.logger.debug(
          `Added into result array an object of seq_id='${cacheValueAsJson[0].id}', description='${cacheValueAsJson[0].description}' and sequence length=${cacheValueAsJson[0].sequence.length}`,
        )
      }
    }

    // If no feature was found
    if (resultJsonArray.length === 0) {
      const errMsg = 'No embedded FASTA sequences found'
      this.logger.error(errMsg)
      throw new NotFoundException(errMsg)
    }

    this.logger.debug(
      `Found (n=${resultJsonArray.length}) embedded FASTA sequences`,
    )
    return resultJsonArray
  }

  /**  Write cache into file
   * @returns Filename where cache was written
   */
  async downloadCacheAsGFF3file(): Promise<string> {
    let cacheValue: string | undefined = ''

    // Join path+filename
    const { DOWNLOADED_OUTPUT_FOLDER } = process.env
    if (!DOWNLOADED_OUTPUT_FOLDER) {
      throw new Error('No DOWNLOADED_OUTPUT_FOLDER found in .env file')
    }
    const downloadFilename = join(
      DOWNLOADED_OUTPUT_FOLDER,
      `downloaded_${getCurrentDateTime()}.gff3`,
    )
    const nberOfEntries = await this.cacheManager.store.keys?.()
    nberOfEntries.sort((n1: number, n2: number) => n1 - n2) // Sort the array
    // Loop cache in sorted order
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
        downloadFilename,
        gff.formatSync(JSON.parse(cacheValue)),
      )
    }
    this.logger.debug(`Cache saved to file ${downloadFilename}' successfully`)
    return downloadFilename
  }

  /**
   * Check if GFF3 is loaded into cache. Basically we check if number of entries is greater than 0 then GFF3 is loaded. Otherwise not
   * @returns TRUE: GFF3 is loaded into cache, otherwise return FALSE
   */
  async checkCacheKeys() {
    const nberOfEntries = await this.cacheManager.store.keys?.()
    // Check if there is any item inside.
    // Later we will check what kind of items there are in cache so we can check specifically if there is GFF3 data
    for (const keyInd of nberOfEntries) {
      this.logger.verbose(`Read key=${keyInd}`) // TODO: Do check logic here
      this.logger.debug('GFF3 is loaded into cache!')
      return true
    }
    this.logger.debug('GFF3 is not loaded in cache!')
    return false
  }

  /**
   * This method check that each line has unique id. If not it creates one for each line and overwrites the orignal file
   */
  async checkGFF3uniqueKey(filenameWithPath: string) {
    const stringOfGFF3 = await fs.readFile(filenameWithPath, {
      encoding: 'utf8',
      flag: 'r',
    })
    this.logger.verbose(`Data read from file=${stringOfGFF3}`)

    const arrayOfThings = gff.parseStringSync(stringOfGFF3, {
      parseAll: true,
    })
    let ind = 0
    this.logger.debug(`Starting to check apollo_ids...`)

    // Loop all lines and check if each line has 'apollo_id' property inside attributes
    for (const entry of arrayOfThings) {
      // Comment, Directive and FASTA -entries are not presented as an array
      if (Array.isArray(entry)) {
        for (const [key, val] of Object.entries(entry)) {
          // const assignedVal = Object.assign(val)
          // if (!assignedVal.attributes.hasOwnProperty('apollo_id')) {
          //   assignedVal.attributes.apollo_id = uuidv4()
          //   ind++
          // }

          if (val.hasOwnProperty('attributes')) {
            const assignedVal = Object.assign(val)
            if (!assignedVal.attributes.hasOwnProperty('apollo_id')) {
              assignedVal.attributes.apollo_id = uuidv4()
              ind++
            }
          }
        }
      }
    }

    // Save into file
    const { FILE_SEARCH_FOLDER, GFF3_DEFAULT_FILENAME_AT_STARTUP } = process.env
    if (!FILE_SEARCH_FOLDER) {
      throw new Error('No FILE_SEARCH_FOLDER found in .env file')
    }
    if (!GFF3_DEFAULT_FILENAME_AT_STARTUP) {
      throw new Error('No GFF3_DEFAULT_FILENAME_AT_STARTUP found in .env file')
    }
    await fs.writeFile(
      join(FILE_SEARCH_FOLDER, GFF3_DEFAULT_FILENAME_AT_STARTUP),
      gff.formatSync(arrayOfThings),
    )
    this.logger.debug(`Apollo id was assigned ${ind} times`)
  }
}
