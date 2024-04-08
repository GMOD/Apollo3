/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import * as crypto from 'node:crypto'
import EventEmitter from 'node:events'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { Agent, RequestInit, Response, fetch } from 'undici'

import { ApolloConf, ConfigError } from './ApolloConf.js'

const CONFIG_PATH = path.resolve(os.homedir(), '.clirc')
export const CLI_SERVER_ADDRESS = 'http://127.0.0.1:5657'
export const CLI_SERVER_ADDRESS_CALLBACK = `${CLI_SERVER_ADDRESS}/auth/callback`

export class CheckError extends Error {}

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

export function checkConfigfileExists(configFile: string) {
  if (!fs.existsSync(configFile)) {
    throw new ConfigError(
      `Configuration file "${configFile}" does not exist. Please run "apollo config" first`,
    )
  }
}

export function checkProfileExists(profileName: string, config: ApolloConf) {
  if (!config.getProfileNames().includes(profileName)) {
    throw new ConfigError(
      `Profile "${profileName}" does not exist. Please run "apollo config" to set this profile up or choose a different profile`,
    )
  }
}

export function basicCheckConfig(configFile: string, profileName: string) {
  checkConfigfileExists(configFile)
  const config: ApolloConf = new ApolloConf(configFile)
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

  const auth: RequestInit = {
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
    const errorMessage = await createFetchErrorMessage(
      response,
      'deleteAssembly failed',
    )
    throw new Error(errorMessage)
  }
}

export async function getAssembly(
  address: string,
  accessToken: string,
  assemblyNameOrId: string,
): Promise<object> {
  const assemblyId: string[] = await convertAssemblyNameToId(
    address,
    accessToken,
    [assemblyNameOrId],
  )
  if (assemblyId.length === 0) {
    return {}
  }
  const res: Response = await queryApollo(address, accessToken, 'assemblies')
  const assemblies: object[] = (await res.json()) as object[]
  let assemblyObj = {}
  for (const x of assemblies) {
    if (x['_id' as keyof typeof x] === assemblyId[0]) {
      assemblyObj = JSON.parse(JSON.stringify(x))
      break
    }
  }
  return assemblyObj
}

export async function getRefseqId(
  address: string,
  accessToken: string,
  refseqNameOrId?: string,
  inAssemblyNameOrId?: string,
): Promise<string[]> {
  if (refseqNameOrId === undefined && inAssemblyNameOrId === undefined) {
    throw new Error('Please provide refseq and/or assembly')
  }
  if (inAssemblyNameOrId === undefined) {
    inAssemblyNameOrId = ''
  }
  let assemblyId: string[] = []
  if (inAssemblyNameOrId !== '') {
    assemblyId = await convertAssemblyNameToId(address, accessToken, [
      inAssemblyNameOrId,
    ])
    if (assemblyId.length !== 1) {
      throw new Error(
        `Assembly name or assembly id returned ${assemblyId.length} assemblies instead of just one`,
      )
    }
  }
  const res: Response = await queryApollo(address, accessToken, 'refSeqs')
  const refSeqs = (await res.json()) as object[]
  const refseqIds: string[] | PromiseLike<string[]> = []
  const nAssemblies = new Set<string>()
  for (const x of refSeqs) {
    const aid = x['assembly' as keyof typeof x]
    const rid = x['_id' as keyof typeof x]
    const rname = x['name' as keyof typeof x]
    if (
      refseqNameOrId === rid ||
      refseqNameOrId === rname ||
      refseqNameOrId === undefined
    ) {
      if (inAssemblyNameOrId === '' || assemblyId.includes(aid)) {
        refseqIds.push(rid)
        nAssemblies.add(aid)
      } else {
        //
      }
    }
    if (nAssemblies.size > 1) {
      throw new Error(
        `Sequence name "${refseqNameOrId}" found in more than one assembly`,
      )
    }
  }
  return refseqIds
}

async function checkNameToIdDict(
  address: string,
  accessToken: string,
): Promise<Record<string, string>> {
  const asm = await queryApollo(address, accessToken, 'checks/types')
  const ja = (await asm.json()) as object[]
  const nameToId: Record<string, string> = {}
  for (const x of ja) {
    const name: string = x['name' as keyof typeof x]
    nameToId[name] = x['_id' as keyof typeof x]
  }
  return nameToId
}

export async function convertCheckNameToId(
  address: string,
  accessToken: string,
  namesOrIds: string[],
): Promise<string[]> {
  const nameToId = await checkNameToIdDict(address, accessToken)
  const ids = []
  for (const x of namesOrIds) {
    if (nameToId[x] !== undefined) {
      ids.push(nameToId[x])
    } else if (Object.values(nameToId).includes(x)) {
      ids.push(x)
    } else {
      throw new CheckError(`Check name or id "${x}" not found`)
    }
  }
  return ids
}

export async function assemblyNameToIdDict(
  address: string,
  accessToken: string,
): Promise<Record<string, string>> {
  const asm = await queryApollo(address, accessToken, 'assemblies')
  const ja = (await asm.json()) as object[]
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
  verbose = true,
  removeDuplicates = true,
): Promise<string[]> {
  const nameToId = await assemblyNameToIdDict(address, accessToken)
  let ids = []
  for (const x of namesOrIds) {
    if (nameToId[x] !== undefined) {
      ids.push(nameToId[x])
    } else if (Object.values(nameToId).includes(x)) {
      ids.push(x)
    } else if (verbose) {
      process.stderr.write(`Warning: Omitting unknown assembly: "${x}"\n`)
    }
  }
  if (removeDuplicates) {
    ids = [...new Set(ids)]
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
  const refJson = filterJsonList(
    (await refSeqs.json()) as object[],
    [refSeq],
    '_id',
  )
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
  if (!response.ok) {
    const errorMessage = await createFetchErrorMessage(
      response,
      'queryApollo failed',
    )
    throw new ConfigError(errorMessage)
  }
  return response
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

interface bodyLocalFile {
  assemblyName: string
  typeName: string
  fileId: string
}
interface bodyExternalFile {
  assemblyName: string
  typeName: string
  externalLocation: {
    fa: string
    fai: string
  }
}

export async function submitAssembly(
  address: string,
  accessToken: string,
  body: bodyLocalFile | bodyExternalFile,
  force: boolean,
): Promise<Response> {
  const assemblies = await queryApollo(address, accessToken, 'assemblies')
  for (const x of (await assemblies.json()) as object[]) {
    if (x['name' as keyof typeof x] === body.assemblyName) {
      if (force) {
        await deleteAssembly(address, accessToken, x['_id' as keyof typeof x])
      } else {
        throw new Error(`Error: Assembly "${body.assemblyName}" already exists`)
      }
    }
  }
  const controller = new AbortController()
  setTimeout(
    () => {
      controller.abort()
    },
    24 * 60 * 60 * 1000,
  )

  const auth = {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    signal: controller.signal,
  }
  const url = new URL(localhostToAddress(`${address}/changes`))
  const response = await fetch(url, auth)
  if (!response.ok) {
    const errorMessage = await createFetchErrorMessage(
      response,
      'submitAssembly failed',
    )
    throw new ConfigError(errorMessage)
  }
  return response
}

export async function uploadFile(
  address: string,
  accessToken: string,
  file: string,
  type: string,
) {
  const filehandle = await fs.promises.open(file)
  const { size } = await filehandle.stat()
  const stream = filehandle.createReadStream({ encoding: 'utf8' })
  const init: RequestInit = {
    method: 'POST',
    body: stream,
    duplex: 'half',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': type,
      'Content-Length': String(size),
    },
    dispatcher: new Agent({
      keepAliveTimeout: 10 * 60 * 1000, // 10 minutes
      keepAliveMaxTimeout: 10 * 60 * 1000, // 10 minutes
    }),
  }

  const fileName = path.basename(file)
  const url = new URL(localhostToAddress(`${address}/files/stream`))
  url.searchParams.set('name', fileName)
  const response = await fetch(url, auth)
  if (!response.ok) {
    const errorMessage = await createFetchErrorMessage(
      response,
      'uploadFile failed',
    )
    throw new ConfigError(errorMessage)
  }
  const json = (await response.json()) as object
  return json['_id' as keyof typeof json]
}

/* Wrap text to max `length` per line */
export function wrapLines(s: string, length?: number): string {
  if (length === undefined) {
    length = 80
  }
  // Credit: https://stackoverflow.com/questions/14484787/wrap-text-in-javascript
  const re = new RegExp(`(?![^\\n]{1,${length}}$)([^\\n]{1,${length}})\\s`, 'g')
  s = s.replaceAll(/ +/g, ' ')
  const wr = s.replace(re, '$1\n')
  return wr
}

export function idReader(input: string[], removeDuplicates = true): string[] {
  let ids = []
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
  if (removeDuplicates) {
    ids = [...new Set(ids)]
  }
  return ids
}
