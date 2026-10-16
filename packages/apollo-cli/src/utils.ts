import * as fs from 'node:fs'
import { stdin } from 'node:process'

import type { Response } from 'undici'

export interface UserCredentials {
  accessToken: string
}

export async function createFetchErrorMessage(
  response: Response,
  additionalText?: string,
): Promise<string> {
  let errorMessage
  try {
    errorMessage = await response.text()
  } catch {
    errorMessage = ''
  }
  const responseMessage = `${response.status} ${response.statusText}${
    errorMessage ? ` (${errorMessage})` : ''
  }`
  return `${additionalText ? `${additionalText} — ` : ''}${responseMessage}`
}

export function createApiURL(address: string, endpoint: string): URL {
  const base = new URL(address)
  // On some systems (macOS?) fetch throws a TypeError for localhost, so use
  // the loopback address instead
  if (base.hostname === 'localhost') {
    base.hostname = '127.0.0.1'
  }
  base.pathname = `${base.pathname.replace(/\/+$/, '')}/`
  return new URL(endpoint, base)
}

export function filterJsonList(
  json: object[],
  keep: string[],
  key: string,
): object[] {
  const unique = new Set(keep)
  const results: object[] = []
  for (const x of json) {
    if (Object.keys(x).includes(key) && unique.has(x[key as keyof typeof x])) {
      results.push(x)
    }
  }
  return results
}

export async function readStdin() {
  const chunks: Buffer[] = []
  for await (const chunk of stdin) {
    chunks.push(Buffer.from(chunk as Buffer))
  }
  return Buffer.concat(chunks).toString('utf8')
}

export async function idReader(
  input: string[],
  removeDuplicates = true,
): Promise<string[]> {
  let ids: string[] = []
  for (const xin of input) {
    let data: string
    if (xin == '-') {
      data = await readStdin()
    } else if (fs.existsSync(xin)) {
      data = fs.readFileSync(xin).toString()
    } else {
      data = xin
    }
    try {
      let parsedData = JSON.parse(data) as
        | Record<string, unknown>
        | [Record<string, unknown>]
      if (!Array.isArray(parsedData)) {
        parsedData = [parsedData]
      }
      for (const x of parsedData) {
        if ('_id' in x && typeof x._id === 'string') {
          ids.push(x._id)
        }
      }
    } catch {
      for (let x of data.split('\n')) {
        x = x.trim()
        if (x !== '') {
          ids.push(x)
        }
      }
    }
  }
  if (removeDuplicates) {
    ids = [...new Set(ids)]
  }
  return ids
}
