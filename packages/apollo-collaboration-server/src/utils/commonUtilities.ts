import fs from 'fs'
import { join } from 'path'

import { PayloadObject } from 'apollo-shared'
import jwtDecode from 'jwt-decode'

// import { fileSearchFolderConfig, GFF3 } from './fileConfig'

/**
 * Returns current datetime in the following format ddmmyyyy_hh24miss
 * @returns Returns current datetime in the following format ddmmyyyy_hh24miss
 */
export function getCurrentDateTime() {
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
 * @param obj1 -
 * @param obj2 -
 * @returns TRUE if JSON objects are equal, otherwise return false
 */
export function compareTwoJsonObjects(obj1: unknown, obj2: unknown) {
  let flag = true
  if (
    typeof obj1 !== 'object' ||
    typeof obj2 !== 'object' ||
    obj1 === null ||
    obj2 === null
  ) {
    throw new Error("can't compare non-object")
  }
  if (Object.keys(obj1).length === Object.keys(obj2).length) {
    for (const key in obj1) {
      if (
        (obj1 as Record<string, unknown>)[key] ===
        (obj2 as Record<string, unknown>)[key]
      ) {
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
 * @param username - User who requested the change
 * @param originalLine - Original line
 * @param updatedLine - Requested change to original file
 */
export function writeIntoGff3ChangeLog(
  username: string,
  originalLine: string,
  updatedLine: string,
) {
  // Write array of things into file
  const fileSearchFolder = process.env.FILE_SEARCH_FOLDER
  if (!fileSearchFolder) {
    throw new Error('No FILE_SEARCH_FOLDER env variable defined')
  }
  const gff3ChangelogFilename = process.env.GFF3_CHANGELOG_FILENAME
  if (!gff3ChangelogFilename) {
    throw new Error('No GFF3_CHANGELOG_FILENAME env variable defined')
  }

  fs.appendFileSync(
    join(fileSearchFolder, gff3ChangelogFilename),
    `${getCurrentDateTime()} : ${username}\n` +
      `ORIGINAL LINE : ${originalLine}\n` +
      `UPDATED VALUE : ${updatedLine}\n`,
  )
}

/**
 * Decode access token
 * @param token -
 * @returns Decoded token
 */
export function getDecodedAccessToken(token: string): PayloadObject {
  return jwtDecode(token)
}
