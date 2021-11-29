import { createWriteStream, existsSync } from 'fs'
import * as fs from 'fs/promises'
import { join } from 'path'

import gff from '@gmod/gff'
import {
  CACHE_MANAGER,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { Cache } from 'cache-manager'
import { Response } from 'express'

import {
  fastaQueryResult,
  fastaSequenceInfo,
  gff3ChangeLineObjectDto,
  regionSearchObjectDto,
} from '../entity/gff3Object.dto'
import { commonUtilities } from '../utils/commonUtilities'

@Injectable()
export class FileHandlingService {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}
  private readonly logger = new Logger(FileHandlingService.name)
  private readonly commUtils = new commonUtilities()

  /**
   * THIS IS JUST FOR DEMO PURPOSE
   * Save new uploaded file into local filesystem. The filename in local filesystem will be: 'uploaded' + timestamp in ddmmyyyy_hh24miss -format + original filename
   * @param newUser New user information
   * @param response
   * @returns Return 'HttpStatus.OK' if save was successful
   * or in case of error return error message with 'HttpStatus.INTERNAL_SERVER_ERROR'
   */
  async saveNewFile(
    file: Express.Multer.File,
    response: Response,
  ): Promise<Response> {
    // Check if filesize is 0
    if (file.size < 1) {
      const msg = `File ${file.originalname} is empty!`
      this.logger.error(msg)
      throw new InternalServerErrorException(msg)
    }
    this.logger.debug(
      `Starting to save file ${file.originalname}, size=${file.size} bytes.`,
    )
    // Join path+filename
    const newFullFileName = join(
      process.env.UPLOADED_OUTPUT_FOLDER,
      `uploaded_${this.commUtils.getCurrentDateTime()}_${file.originalname}`,
    )
    this.logger.debug(`New file will be saved as ${newFullFileName}`)

    // Save file
    const ws = createWriteStream(newFullFileName)
    ws.write(file.buffer)
    ws.close()
    return response.status(HttpStatus.OK).json({
      status: HttpStatus.OK,
      message: `File ${file.originalname} was saved`,
    })
  }

  /**
   * Check if given filename exists in default folder
   * @param filename New user information
   * @param response
   * @returns Return TRUE if file exists, otherwise return FALSE
   */
  fileExists(filename: string): boolean {
    try {
      // Join path+filename
      const newFullFileName = join(process.env.FILE_SEARCH_FOLDER, filename)
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
   * THIS IS JUST FOR DEMO PURPOSE
   * Update existing GFF3 file in local filesystem.
   */
  async updateGFF3File(postDto: gff3ChangeLineObjectDto, response: Response) {
    // // Check if file exists: "Using fs.exists() to check for the existence of a file before calling fs.open(), fs.readFile() or fs.writeFile() is not recommended"
    // if (!this.fileExists(postDto.filename)) {
    //   this.logger.error(
    //     `File =${postDto.filename}= does not exist in folder =${process.env.FILE_SEARCH_FOLDER}=`,
    //   )
    //   throw new NotFoundException(`File ${postDto.filename} does not exist!`)
    // }

    // Join path+filename
    const fullFileName = join(process.env.FILE_SEARCH_FOLDER, postDto.filename)

    const oldValue = postDto.originalLine
    const newValue = postDto.updatedLine

    // Read the file
    await fs
      .readFile(fullFileName, 'utf8')
      .then(async (data) => {
        // Check that there is at least one occurance of search string in the file
        if (data.indexOf(oldValue) >= 0) {
          const replacer = new RegExp(oldValue, 'g')
          const change = data.replace(replacer, newValue)
          // Write updated content back to file
          await fs.writeFile(fullFileName, change, 'utf8')

          this.logger.debug(`File ${postDto.filename} successfully updated!`)
          return response.status(HttpStatus.OK).json({
            status: HttpStatus.OK,
            message: `File ${postDto.filename} successfully updated!`,
          })
        }
        const errMsg = `ERROR when updating file: The following string was not found in GFF3 file='${oldValue}'`
        this.logger.error(errMsg)
        throw new NotFoundException(errMsg)
      })
      .catch((err) => {
        this.logger.error(`ERROR when reading/updating file: ${err}`)
        throw new InternalServerErrorException(
          `ERROR in updateGFF3File() : ${err}`,
        )
      })
  }

  /**
   * Loads GFF3 file data into cache. Cache key is started from 0
   * @param filename File where data is loaded into cache
   * @param res
   * @returns
   */
  async loadGff3IntoCache(
    filename: string,
    res: Response<any, Record<string, any>>,
  ) {
    // Check if file exists
    if (!this.fileExists(filename)) {
      this.logger.error(
        `File =${filename}= does not exist in folder =${process.env.FILE_SEARCH_FOLDER}=`,
      )
      throw new InternalServerErrorException(`File ${filename} does not exist!`)
    }
    // Load GFF3 file into cache
    this.loadGFF3FileIntoCache(filename)

    return res
      .status(HttpStatus.OK)
      .json({ status: 'GFF3 file loaded into cache' })
  }

  /**
   * Updates string (or whole line) in CACHE
   * @param postDto Data Transfer Object that contains information about original string/line and updated string/line
   * @param response
   * @returns
   */
  async updateGFF3Cache(postDto: gff3ChangeLineObjectDto, response: Response) {
    let cacheValue = ''
    let cacheKey = -1 // Cache key that specifies the row that we update. All cache keys are > 0
    const oldValue = postDto.originalLine // Search this string in cache
    const oldValueAsJson = JSON.parse(postDto.originalLine)
    const newValue = JSON.parse(postDto.updatedLine) // JSON object that contains those key-value -pairs that we will update

    this.logger.debug(`Search string=${oldValue}=`)
    try {
      const nberOfEntries = await this.cacheManager.store.keys()
      nberOfEntries.sort((n1, n2) => n1 - n2) // Sort the array

      // Loop cache and compare each cache row to postDto.originalLine
      for (const keyInd of nberOfEntries) {
        cacheValue = await this.cacheManager.get(keyInd)
        this.logger.verbose(
          `Read line from cache=${cacheValue}=, key=${keyInd}`,
        )
        // Check if cache line is same as 'originalLine' -parameter
        if (this.commUtils.compareTwoJsonObjects(oldValue, cacheValue)) {
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

      await fs.writeFile(
        join(
          process.env.FILE_SEARCH_FOLDER,
          process.env.GFF3_DEFAULT_FILENAME_TO_SAVE,
        ),
        '',
      )

      nberOfEntries.sort((n1, n2) => n1 - n2) // Sort the array
      // Loop cache in sorted order
      for (const keyInd of nberOfEntries) {
        cacheValue = await this.cacheManager.get(keyInd.toString())
        this.logger.verbose(
          `Write into file =${JSON.stringify(cacheValue)}, key=${keyInd}`,
        )
        // Write into file line by line
        fs.appendFile(
          join(
            process.env.FILE_SEARCH_FOLDER,
            process.env.GFF3_DEFAULT_FILENAME_TO_SAVE,
          ),
          gff.formatSync(JSON.parse(cacheValue)),
        )
      }
      // Write change -information into separate change log -file
      this.commUtils.writeIntoGff3ChangeLog(
        'user xxx', // TODO: DON'T USE HARD CODED VALUES IN PRODUCTION!
        postDto.originalLine,
        postDto.updatedLine,
      )

      this.logger.debug('Cache and GFF3 file updated successfully')
      return response.status(HttpStatus.OK).json({
        status: HttpStatus.OK,
        message: 'Cache and GFF3 file updated successfully!',
      })
    } catch (err) {
      this.logger.error(`ERROR when updating cache: ${err}`)
      throw new InternalServerErrorException(
        `ERROR in updateGFF3Cache() : ${err}`,
      )
    }
  }

  // /**
  //  * Loads GFF3 file into cache
  //  * @param filename GFF3 filename where data is loaded
  //  */
  // async loadGFF3FileIntoCache(filename: string) {
  //   try {
  //     this.logger.debug(`Starting to load gff3 file ${filename} into cache!`)

  //     // parse a string of gff3 synchronously
  //     const stringOfGFF3 = await fs.readFile(
  //       join(process.env.FILE_SEARCH_FOLDER, filename),
  //       { encoding: 'utf8', flag: 'r' },
  //     )

  //     this.logger.verbose(`Data read from file=${stringOfGFF3}`)
  //     // Clear old entries from cache
  //     this.cacheManager.reset()

  //     const arrayOfThings = await gff.parseStringSync(stringOfGFF3, {
  //       parseAll: true,
  //     })
  //     let ind = 0

  //     // Loop all lines and add those into cache
  //     for (const entry of arrayOfThings) {
  //       // Comment, Directive and FASTA -entries are not presented as an array so let's put entry into array because gff.formatSync() -method requires an array as argument
  //       if (!Array.isArray(entry)) {
  //         const result = [entry]
  //         this.cacheManager.set(ind.toString(), JSON.stringify(result))
  //         this.logger.verbose(
  //           `Add Comments, Directive or FASTA into cache=${JSON.stringify(
  //             result,
  //           )}`,
  //         )
  //       } else {
  //         this.cacheManager.set(ind.toString(), JSON.stringify(entry))
  //         this.logger.verbose(
  //           `Add into cache new entry=${JSON.stringify(entry)}`,
  //         )
  //       }
  //       ind++
  //     }
  //     const nberOfEntries = await this.cacheManager.store.keys()
  //     this.logger.debug(`Added ${nberOfEntries.length} entries to cache`)
  //   } catch (err) {
  //     this.logger.error(`Could not load GFF3 file into cache:${err}`)
  //     throw new InternalServerErrorException(
  //       `Could not load GFF3 file into cache:${err}`,
  //     )
  //   }
  // }

  /**
   * Loads GFF3 file into cache
   * @param filename GFF3 filename where data is loaded
   */
  async loadGFF3FileIntoCache(filename: string) {
    this.logger.debug(`Starting to load gff3 file ${filename} into cache!`)

    // parse a string of gff3 synchronously
    await fs
      .readFile(join(process.env.FILE_SEARCH_FOLDER, filename), {
        encoding: 'utf8',
        flag: 'r',
      })
      .then(async (stringOfGFF3) => {
        this.logger.verbose(`Data read from file=${stringOfGFF3}`)
        // Clear old entries from cache
        this.cacheManager.reset()

        const arrayOfThings = await gff.parseStringSync(stringOfGFF3, {
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
            this.logger.verbose(
              `Add into cache new entry=${JSON.stringify(entry)}`,
            )
          }
          ind++
        }
        const nberOfEntries = await this.cacheManager.store.keys()
        this.logger.debug(`Added ${nberOfEntries.length} entries to cache`)
      })
      .catch((err) => {
        this.logger.error(`Could not load GFF3 file into cache:${err}`)
        throw new InternalServerErrorException(
          `Could not load GFF3 file into cache:${err}`,
        )
      })
  }

  /**
   * Fetch features based on Reference seq, Start and End -values
   * @param searchDto Data Transfer Object that contains information about searchable region
   * @param res
   * @returns Return 'HttpStatus.OK' and array of features (as JSON) if search was successful
   * or if search data was not found or in case of error return throw exception
   */
  async getFeaturesByCriteria(
    searchDto: regionSearchObjectDto,
    res: Response<any, Record<string, any>>,
  ) {
    let cacheValue = ''
    let cacheValueAsJson
    const resultJsonArray = [] // Return JSON array

    try {
      const nberOfEntries = await this.cacheManager.store.keys()

      this.logger.debug(
        `Feature search criteria is refName=${
          searchDto.refName
        }, start=${JSON.stringify(searchDto.start)} and end=${JSON.stringify(
          searchDto.end,
        )}`,
      )

      // Loop cache
      for (const keyInd of nberOfEntries) {
        cacheValue = await this.cacheManager.get(keyInd)
        cacheValueAsJson = JSON.parse(cacheValue)
        this.logger.verbose(
          `Cache SEQ_ID=${cacheValueAsJson[0].seq_id}, START=${cacheValueAsJson[0].start} and END=${cacheValueAsJson[0].end}`,
        )
        // Compare cache values vs. searchable values
        if (
          cacheValueAsJson[0].hasOwnProperty('seq_id') &&
          cacheValueAsJson[0].hasOwnProperty('start') &&
          cacheValueAsJson[0].hasOwnProperty('end') &&
          cacheValueAsJson[0].seq_id === searchDto.refName &&
          cacheValueAsJson[0].end > searchDto.start &&
          cacheValueAsJson[0].start < searchDto.end
        ) {
          this.logger.debug(
            `Matched found refName=${cacheValueAsJson[0].seq_id}, start=${cacheValueAsJson[0].start} and end=${cacheValueAsJson[0].end}`,
          )
          // Add found feature into array
          resultJsonArray.push(cacheValueAsJson[0])
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
      return res.status(HttpStatus.OK).json(resultJsonArray)
    } catch (err) {
      this.logger.error(`ERROR when searching features by criteria: ${err}`)
      throw new HttpException(
        `ERROR in getFeaturesByCriteria() : ${err}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }

  /**
   * Fetch embedded FASTA sequence based on Reference seq, Start and End -values
   * @param searchDto Data Transfer Object that contains information about searchable sequence
   * @param res
   * @returns Return 'HttpStatus.OK' and embedded FASTA sequence if search was successful
   * or if search data was not found or in case of error throw exception
   */
  async getFastaByCriteria(
    searchDto: regionSearchObjectDto,
    res: Response<any, Record<string, any>>,
  ) {
    let cacheValue = ''
    let cacheValueAsJson, keyArray
    const resultObject = new fastaQueryResult()

    try {
      const nberOfEntries = await this.cacheManager.store.keys()

      this.logger.debug(
        `Fasta search criteria is refName=${
          searchDto.refName
        }, start=${JSON.stringify(searchDto.start)} and end=${JSON.stringify(
          searchDto.end,
        )}`,
      )

      // Loop cache
      for (const keyInd of nberOfEntries) {
        cacheValue = await this.cacheManager.get(keyInd)
        cacheValueAsJson = JSON.parse(cacheValue)
        this.logger.verbose(`Cache SEQ_ID=${cacheValueAsJson[0].id}`)
        keyArray = Object.keys(cacheValueAsJson[0])
        // Compare cache id vs. searchable refName. FASTA sequence object size is three ('id', 'description' and 'sequence')
        if (
          keyArray.length === 3 &&
          cacheValueAsJson[0].hasOwnProperty('id') &&
          cacheValueAsJson[0].hasOwnProperty('description') &&
          cacheValueAsJson[0].hasOwnProperty('sequence') &&
          cacheValueAsJson[0].id === searchDto.refName
        ) {
          // Check end position
          if (searchDto.end > cacheValueAsJson[0].sequence.length) {
            const errMsg = `ERROR. Searched FASTA end position ${JSON.stringify(
              searchDto.end,
            )} is out range. Sequence lenght is only ${
              cacheValueAsJson[0].sequence.length
            }`
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
            JSON.stringify(searchDto.start),
            JSON.stringify(searchDto.end),
          )
          this.logger.debug(
            `Found sequence refName=${cacheValueAsJson[0].id} and sequence=${foundSequence}`,
          )
          resultObject.id = cacheValueAsJson[0].id
          resultObject.description = cacheValueAsJson[0].description
          resultObject.sequence = foundSequence
          return res.status(HttpStatus.OK).json(resultObject)
        }
      }

      throw new NotFoundException(
        `Fasta sequence for criteria refName=${
          searchDto.refName
        }, start=${JSON.stringify(searchDto.start)} and end=${JSON.stringify(
          searchDto.end,
        )} was not found`,
      )
    } catch (err) {
      this.logger.error(
        `ERROR when searching fasta sequence by criteria: ${err}`,
      )
      throw new HttpException(
        `ERROR in getFastaByCriteria() : ${err}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }

  /**
   * Get list of embedded FASTA sequences
   * @param res
   * @returns Return 'HttpStatus.OK' and list of embedded FASTA sequences as array of fastaSequenceInfo -object
   * or if no data was found or in case of error throw exception
   */
  async getFastaInfo(res: Response<any, Record<string, any>>) {
    let cacheValue = ''
    let cacheValueAsJson, keyArray
    const resultJsonArray = [] // Return JSON array

    try {
      const nberOfEntries = await this.cacheManager.store.keys()
      this.logger.debug('Get embedded FASTA information')

      // Loop cache
      for (const keyInd of nberOfEntries) {
        cacheValue = await this.cacheManager.get(keyInd)
        cacheValueAsJson = JSON.parse(cacheValue)
        keyArray = Object.keys(cacheValueAsJson[0])
        // FASTA sequence object size is three ('id', 'description' and 'sequence')
        if (
          keyArray.length === 3 &&
          cacheValueAsJson[0].hasOwnProperty('id') &&
          cacheValueAsJson[0].hasOwnProperty('description') &&
          cacheValueAsJson[0].hasOwnProperty('sequence')
        ) {
          const tmpInfoObject = new fastaSequenceInfo()
          tmpInfoObject.refName = cacheValueAsJson[0].id
          tmpInfoObject.description = cacheValueAsJson[0].description
          tmpInfoObject.length = cacheValueAsJson[0].sequence.length
          resultJsonArray.push(tmpInfoObject)
          this.logger.debug(
            `Added into result array an object of SEQ_ID=${cacheValueAsJson[0].id}, DESCRIPTION='${cacheValueAsJson[0].description}' and SEQUENCE LENGTH=${cacheValueAsJson[0].sequence.length}`,
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
      return res.status(HttpStatus.OK).json(resultJsonArray)
    } catch (err) {
      this.logger.error(`ERROR when searching embedded FASTA sequences: ${err}`)
      throw new HttpException(
        `ERROR in getFastaInfo() : ${err}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }
}
