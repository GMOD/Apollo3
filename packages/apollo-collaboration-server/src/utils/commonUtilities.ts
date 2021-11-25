import { join } from 'path'

import { Injectable } from '@nestjs/common'

// import { fileSearchFolderConfig, GFF3 } from './fileConfig'

@Injectable()
export class commonUtilities {
  /**
   * Returns current datetime in the following format ddmmyyyy_hh24miss
   * @returns Returns current datetime in the following format ddmmyyyy_hh24miss
   */
  getCurrentDateTime() {
    const date = new Date()
    const dayNber = `0${date.getDate()}`.slice(-2)
    const monthNber = `0${date.getMonth() + 1}`.slice(-2)
    const yearNber = date.getFullYear().toString()
    const hourNber = `0${date.getHours()}`.slice(-2)
    const minuteNber = `0${date.getMinutes()}`.slice(-2)
    const secondNber = `0${date.getSeconds()}`.slice(-2)
    const ret = `${
      dayNber + monthNber + yearNber
    }_${hourNber}${minuteNber}${secondNber}`
    return ret
  }

  /**
   * Compares two JSON objects.
   * @param obj1
   * @param obj2
   * @returns TRUE if JSON objects are equal, otherwise return false
   */
  compareTwoJsonObjects(obj1: any, obj2: any) {
    let flag = true
    if (Object.keys(obj1).length == Object.keys(obj2).length) {
      for (const key in obj1) {
        if (obj1[key] == obj2[key]) {
          continue
        } else {
          flag = false
          break
        }
      }
    } else {
      flag = false
    }
    return flag
  }

  /**
   * Add line into GFF3 change log
   * @param username User who requested the change
   * @param originalLine Original line
   * @param updatedLine Requested change to original file
   */
  writeIntoGff3ChangeLog(
    username: string,
    originalLine: string,
    updatedLine: string,
  ) {
    // Write array of things into file
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('fs')

    fs.appendFile(
      join(process.env.FILE_SEARCH_FOLDER, process.env.GFF3_CHANGELOG_FILENAME),
      `${this.getCurrentDateTime()} : ${username}\n`,
    )
    fs.appendFile(
      join(process.env.FILE_SEARCH_FOLDER, process.env.GFF3_CHANGELOG_FILENAME),
      `ORIGINAL LINE : ${originalLine}\n`,
    )
    fs.appendFile(
      join(process.env.FILE_SEARCH_FOLDER, process.env.GFF3_CHANGELOG_FILENAME),
      `UPDATED VALUE : ${updatedLine}\n`,
    )
    fs.close()
  }
}
