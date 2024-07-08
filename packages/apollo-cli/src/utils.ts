import * as crypto from 'node:crypto'
import EventEmitter from 'node:events'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { stdin, stderr } from 'node:process'
import {
  Transform,
  TransformCallback,
  TransformOptions,
  pipeline,
} from 'node:stream'

import { type SerializedDeleteAssemblyChange } from '@apollo-annotation/shared'

import { SingleBar } from 'cli-progress'
import { Agent, RequestInit, Response, fetch } from 'undici'

import { ApolloConf, ConfigError } from './ApolloConf.js'
import {
  ApolloAssemblySnapshot,
  CheckResultSnapshot,
} from '@apollo-annotation/mst'

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
  const body: SerializedDeleteAssemblyChange = {
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
    dispatcher: new Agent({ headersTimeout: 60 * 60 * 1000 }),
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
): Promise<ApolloAssemblySnapshot> {
  const assemblyId: string[] = await convertAssemblyNameToId(
    address,
    accessToken,
    [assemblyNameOrId],
  )
  if (assemblyId.length === 0) {
    throw new Error(`Assembly "${assemblyNameOrId}" not found`)
  }
  const res: Response = await queryApollo(address, accessToken, 'assemblies')
  const assemblies = (await res.json()) as ApolloAssemblySnapshot[]
  for (const x of assemblies) {
    if (x._id === assemblyId[0]) {
      return JSON.parse(JSON.stringify(x)) as ApolloAssemblySnapshot
    }
  }
  throw new Error(`Assembly "${assemblyNameOrId}" not found`)
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
): Promise<Record<string, string | undefined>> {
  const asm = await queryApollo(address, accessToken, 'checks/types')
  const ja = (await asm.json()) as CheckResultSnapshot[] // Not sure if CheckResultSnapshot is the right interface
  const nameToId: Record<string, string> = {}
  for (const x of ja) {
    const { _id, name } = x // x['name' as keyof typeof x]
    nameToId[name] = _id // x['_id' as keyof typeof x]
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
): Promise<Record<string, string | undefined>> {
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
      stderr.write(`Warning: Omitting unknown assembly: "${x}"\n`)
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
  const auth: RequestInit = {
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
  const auth: RequestInit = {
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
): Promise<object> {
  let assemblies = await queryApollo(address, accessToken, 'assemblies')
  for (const x of (await assemblies.json()) as object[]) {
    if (x['name' as keyof typeof x] === body.assemblyName) {
      if (force) {
        await deleteAssembly(address, accessToken, x['_id' as keyof typeof x])
      } else {
        throw new Error(`Error: Assembly "${body.assemblyName}" already exists`)
      }
    }
  }

  const auth: RequestInit = {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    dispatcher: new Agent({ headersTimeout: 60 * 60 * 1000 }),
  }
  const url = new URL(localhostToAddress(`${address}/changes`))
  const response = await fetch(url, auth)
  if (!response.ok) {
    const errorMessage = await createFetchErrorMessage(
      response,
      'submitAssembly failed',
    )
    throw new Error(errorMessage)
  }
  assemblies = await queryApollo(address, accessToken, 'assemblies')
  for (const x of (await assemblies.json()) as object[]) { 
    if (x['name' as keyof typeof x] === body.assemblyName) {
      return x
    }
  }
  throw new Error(`Failed to retrieve assembly ${body.assemblyName}`)
}

interface ProgressTransformOptions extends TransformOptions {
  progressBar: SingleBar
}

class ProgressTransform extends Transform {
  private size = 0

  private progressBar: SingleBar

  constructor(opts: ProgressTransformOptions) {
    super(opts)
    this.progressBar = opts.progressBar
  }

  _transform(
    chunk: Buffer,
    _encoding: BufferEncoding,
    callback: TransformCallback,
  ): void {
    this.size += chunk.length
    this.progressBar.update(this.size)
    callback(null, chunk)
  }
}

export async function uploadFile(
  address: string,
  accessToken: string,
  file: string,
  type: string,
) {
  const filehandle = await fs.promises.open(file)
  const { size } = await filehandle.stat()
  const stream = filehandle.createReadStream()
  const progressBar = new SingleBar({ etaBuffer: 100_000_000 })
  const progressTransform = new ProgressTransform({ progressBar })
  const body = pipeline(stream, progressTransform, (error) => {
    if (error) {
      progressBar.stop()
      console.error('Error processing file.', error)
      throw error
    }
  })
  const init: RequestInit = {
    method: 'POST',
    body,
    duplex: 'half',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': type,
      'Content-Length': String(size),
    },
    dispatcher: new Agent({ headersTimeout: 60 * 60 * 1000 }),
  }

  const fileName = path.basename(file)
  const url = new URL(localhostToAddress(`${address}/files`))
  url.searchParams.set('name', fileName)
  url.searchParams.set('type', type)
  progressBar.start(size, 0)
  try {
    const response = await fetch(url, init)
    if (!response.ok) {
      const errorMessage = await createFetchErrorMessage(
        response,
        'uploadFile failed',
      )
      throw new ConfigError(errorMessage)
    }
    const json = (await response.json()) as object
    return json['_id' as keyof typeof json]
  } catch (error) {
    console.error(error)
    throw error
  } finally {
    progressBar.stop()
  }
}

/* Wrap text to max `length` per line */
export function wrapLines(s: string, length = 80): string {
  // Credit: https://stackoverflow.com/questions/14484787/wrap-text-in-javascript
  const re = new RegExp(`(?![^\\n]{1,${length}}$)([^\\n]{1,${length}})\\s`, 'g')
  s = s.replaceAll(/ +/g, ' ')
  const wr = s.replace(re, '$1\n')
  return wr
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
