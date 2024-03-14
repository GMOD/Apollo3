import * as crypto from 'node:crypto'
import EventEmitter from 'node:events'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { Config, ConfigError } from './Config.js'

const CONFIG_PATH = path.resolve(os.homedir(), '.clirc')
export const CLI_SERVER_ADDRESS = 'http://127.0.0.1:5657'
export const CLI_SERVER_ADDRESS_CALLBACK = `${CLI_SERVER_ADDRESS}/auth/callback`
export interface UserCredentials {
  accessToken: string
}

export function checkConfigfileExists(configFile: string) {
  if (!fs.existsSync(configFile)) {
    throw new ConfigError(
      `Configuration file "${configFile}" does not exist. Please run "apollo config" first`,
    )
  }
}

export function checkProfileExists(profileName: string, config: Config) {
  if (!config.getProfileNames().includes(profileName)) {
    throw new ConfigError(
      `Profile "${profileName}" does not exist. Please run "apollo config" to set this profile up or choose a different profile`,
    )
  }
}

export function basicCheckConfig(configFile: string, profileName: string) {
  checkConfigfileExists(configFile)
  const config: Config = new Config(configFile)
  checkProfileExists(profileName, config)
}

/**
 * @deprecated Use this function while we wait to resolve the TypeError when using localhost in fetch.
 */
export function localhostToAddress(url: string) {
  /** This is hacked function that should become redundant: On my MacOS (?)
   * localhost must be converted to address otherwise fetch throws TypeError
   * */
  return url.replace('//localhost', '127.0.0.1')
}

export async function deleteAssembly(
  address: string,
  accessToken: string,
  assemblyId: string,
): Promise<void> {
  const body = {
    typeName: 'DeleteAssemblyChange',
    assembly: assemblyId,
  }

  const auth = {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  }

  const url = new URL(localhostToAddress(`${address}/changes`))
  const response = await fetch(url, auth)
  if (!response.ok) {
    const json = JSON.parse(await response.text())
    const message: string = json['message' as keyof typeof json]
    throw new Error(message)
  }
}

export async function getRefseqId(
  address: string,
  accessToken: string,
  refseqNameOrId: string,
  inAssembly?: string,
): Promise<string[]> {
  if (inAssembly === undefined) {
    inAssembly = ''
  }
  const res: Response = await queryApollo(address, accessToken, 'refSeqs')
  const refSeqs = await res.json()
  let assemblyId: string[] = []
  if (inAssembly !== '') {
    assemblyId = await convertAssemblyNameToId(address, accessToken, [
      inAssembly,
    ])
  }
  const refseqIds = []
  for (const x of refSeqs) {
    const aid = x['assembly' as keyof typeof x]
    const rid = x['_id' as keyof typeof x]
    const rname = x['name' as keyof typeof x]
    if (refseqNameOrId === rid || refseqNameOrId === rname) {
      if (inAssembly === '' || assemblyId.includes(aid)) {
        refseqIds.push(rid)
      } else {
        //
      }
    }
  }
  return refseqIds
}

async function assemblyNamesToIds(
  address: string,
  accessToken: string,
): Promise<Record<string, string>> {
  const asm = await queryApollo(address, accessToken, 'assemblies')
  const ja = await asm.json()
  const nameToId: Record<string, string> = {}
  for (const x of ja) {
    nameToId[x['name' as keyof typeof x]] = x['_id' as keyof typeof x]
  }
  return nameToId
}

/** In input array namesOrIds, substitute common names with internal IDs */
export async function convertAssemblyNameToId(
  address: string,
  accessToken: string,
  namesOrIds: string[],
): Promise<string[]> {
  const nameToId = await assemblyNamesToIds(address, accessToken)
  const ids = []
  for (const x of namesOrIds) {
    if (nameToId[x] !== undefined) {
      ids.push(nameToId[x])
    } else if (Object.values(nameToId).includes(x)) {
      ids.push(x)
    } else {
      process.stderr.write(`Warning: Omitting unknown assembly: "${x}"\n`)
    }
  }
  return ids
}

export async function getFeatureById(
  address: string,
  accessToken: string,
  id: string,
): Promise<Response> {
  const url = new URL(localhostToAddress(`${address}/features/${id}`))
  const auth = {
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  }
  const response = await fetch(url, auth)
  return response
}

export async function getAssemblyFromRefseq(
  address: string,
  accessToken: string,
  refSeq: string,
): Promise<string> {
  const refSeqs: Response = await queryApollo(address, accessToken, 'refSeqs')
  const refJson = filterJsonList(await refSeqs.json(), [refSeq], '_id')
  return refJson[0]['assembly' as keyof (typeof refJson)[0]]
}

export async function queryApollo(
  address: string,
  accessToken: string,
  endpoint: string,
): Promise<Response> {
  const auth = {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  }
  const url = new URL(localhostToAddress(`${address}/${endpoint}`))
  const response = await fetch(url, auth)
  if (response.ok) {
    return response
  }
  const msg = `Failed to access Apollo with the current address and/or access token\nThe server returned:\n${response.statusText}`
  throw new ConfigError(msg)
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

export const getUserCredentials = (): UserCredentials | null => {
  try {
    const content = fs.readFileSync(CONFIG_PATH, { encoding: 'utf8' })
    return JSON.parse(content) as UserCredentials
  } catch {
    return null
  }
}

export const generatePkceChallenge = (): {
  state: string
  codeVerifier: string
  codeChallenge: string
} => {
  const codeVerifier = crypto.randomBytes(64).toString('hex')

  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')

  return {
    state: crypto.randomBytes(32).toString('hex'),
    codeVerifier,
    codeChallenge,
  }
}

export const waitFor = <T>(
  eventName: string,
  emitter: EventEmitter,
): Promise<T> => {
  const promise = new Promise<T>((resolve, reject) => {
    const handleEvent = (eventData: T): void => {
      eventData instanceof Error ? reject(eventData) : resolve(eventData)

      emitter.removeListener(eventName, handleEvent)
    }

    emitter.addListener(eventName, handleEvent)
  })

  return promise
}

export async function uploadFile(
  address: string,
  accessToken: string,
  file: string,
  type: string,
): Promise<string> {
  const buffer: string = fs.readFileSync(file, 'utf8')
  const blob = new Blob([buffer])
  await blob.text()

  const formData = new FormData()
  formData.append('type', type)
  formData.append('file', blob)

  const auth = {
    method: 'POST',
    body: formData,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  }

  const url = new URL(localhostToAddress(`${address}/files`))
  try {
    const response = await fetch(url, auth)
    const json = (await response.json()) as object
    return json['_id' as keyof typeof json]
  } catch (error) {
    console.error(error)
    throw error
  }
}

export function idReader(input: string[]): string[] {
  const ids = []
  for (const xin of input) {
    let data
    if (xin == '-') {
      data = fs.readFileSync('/dev/stdin').toString()
    } else if (fs.existsSync(xin)) {
      data = fs.readFileSync(xin).toString()
    } else {
      data = xin
    }
    try {
      data = JSON.parse(data)
      if (data.length === undefined) {
        data = [data]
      }
      for (const x of data) {
        const id = x['_id' as keyof typeof x]
        if (id !== undefined) {
          ids.push(id)
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
  return ids
}
