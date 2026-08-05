import path from 'node:path'
import { stderr } from 'node:process'

import { Command, Flags, type Interfaces } from '@oclif/core'
import { ObjectId } from 'bson'
import ms, { type StringValue } from 'ms'
import { Agent, fetch, type RequestInit, type BodyInit, Headers } from 'undici'

import { ApolloConf, ConfigError } from './ApolloConf.js'
import {
  createFetchErrorMessage,
  filterJsonList,
  localhostToAddress,
} from './utils.js'
import type {
  AnnotationFeatureSnapshot,
  CheckResultSnapshot,
} from '@apollo-annotation/mst'
import type {
  SerializedAddAssemblyAndFeaturesFromFileChange,
  SerializedAddAssemblyFromExternalChange,
  SerializedAddAssemblyFromFileChange,
  SerializedDeleteAssemblyChange,
} from '@apollo-annotation/shared'

interface AssemblyResponse {
  _id: string
  name: string
  aliases?: string[]
}

export class CheckError extends Error {}

export type Flags<T extends typeof Command> = Interfaces.InferredFlags<
  (typeof BaseCommand)['baseFlags'] & T['flags']
>
export type Args<T extends typeof Command> = Interfaces.InferredArgs<T['args']>
export abstract class BaseCommand<T extends typeof Command> extends Command {
  static baseFlags = {
    profile: Flags.string({
      description: 'Use credentials from this profile',
    }),
    'config-file': Flags.string({
      description: 'Use this config file (mostly for testing)',
    }),
    timeout: Flags.string({
      description: 'Timeout for each request to the server',
      default: '1h',
    }),
  }

  protected flags!: Flags<T>
  protected args!: Args<T>
  protected apolloConfig!: ApolloConf

  public async init(): Promise<void> {
    await super.init()
    const { args, flags } = await this.parse({
      flags: this.ctor.flags,
      baseFlags: (super.ctor as typeof BaseCommand).baseFlags,
      args: this.ctor.args,
      strict: this.ctor.strict,
    })
    this.flags = flags as Flags<T>
    this.args = args as Args<T>
    let { 'config-file': configFile } = this.flags
    configFile ??= path.join(this.config.configDir, 'config.yml')
    const apolloConfig = new ApolloConf(configFile)
    const { profile } = this.flags
    const profileName = process.env.APOLLO_PROFILE ?? profile ?? 'default'
    if (
      this.id !== 'config' &&
      !apolloConfig.getProfileNames().includes(profileName)
    ) {
      throw new ConfigError(
        `Profile "${profileName}" does not exist. Please run "apollo config" to set this profile up or choose a different profile`,
      )
    }
    this.apolloConfig = apolloConfig
  }

  protected getConfig(): ApolloConf {
    return this.apolloConfig
  }

  public async getAccess(): Promise<{ address: string; accessToken: string }> {
    const { profile } = this.flags
    const config: ApolloConf = this.getConfig()

    const profileName = process.env.APOLLO_PROFILE ?? profile ?? 'default'

    return config.getAccess(profileName)
  }

  getDispatcher() {
    const { timeout } = this.flags
    const timeoutMs = ms(timeout as StringValue)
    return new Agent({ headersTimeout: timeoutMs })
  }

  private async getURL(endpoint: string) {
    const { address } = await this.getAccess()
    return new URL(endpoint, localhostToAddress(address))
  }

  private async getHeaders(options?: RequestInit, json = true) {
    const { accessToken } = await this.getAccess()
    const headers = new Headers(options?.headers)
    headers.set('authorization', `Bearer ${accessToken}`)
    if (json) {
      headers.set('Content-Type', 'application/json')
    }
    return headers
  }

  private async fetchAndCheck(input: URL, init: RequestInit) {
    const response = await fetch(input, init)
    if (!response.ok) {
      const errorMessage = await createFetchErrorMessage(
        response,
        `Request to "${input.href}" failed`,
      )
      throw new Error(errorMessage)
    }
    return response
  }

  public async fetch(endpoint: string, options?: RequestInit) {
    const url = await this.getURL(endpoint)
    const headers = await this.getHeaders(options, false)
    const dispatcher = this.getDispatcher()
    const optionsWithAuth: RequestInit = {
      ...options,
      dispatcher,
      headers,
    }
    return this.fetchAndCheck(url, optionsWithAuth)
  }

  public async post(
    endpoint: string,
    body: BodyInit,
    options?: RequestInit,
  ): Promise<unknown> {
    const url = await this.getURL(endpoint)
    const headers = await this.getHeaders(options)
    const dispatcher = this.getDispatcher()
    const optionsWithAuth: RequestInit = {
      ...options,
      body,
      dispatcher,
      headers,
      method: 'POST',
    }
    const response = await this.fetchAndCheck(url, optionsWithAuth)
    return response.json()
  }

  public async get(endpoint: string, options?: RequestInit): Promise<unknown> {
    const url = await this.getURL(endpoint)
    const headers = await this.getHeaders(options)
    const dispatcher = this.getDispatcher()
    const optionsWithAuth: RequestInit = {
      ...options,
      headers,
      dispatcher,
      method: 'GET',
    }
    const response = await this.fetchAndCheck(url, optionsWithAuth)
    return response.json()
  }

  protected async catch(err: Error & { exitCode?: number }): Promise<unknown> {
    if (err.cause instanceof Error) {
      console.error(err.cause)
    }
    return super.catch(err)
  }

  protected async finally(_: Error | undefined): Promise<unknown> {
    // called after run and catch regardless of whether or not the command errored
    return super.finally(_)
  }

  async assemblyNameToIdDict(): Promise<Record<string, string | undefined>> {
    const ja = (await this.get('assemblies')) as object[]
    const nameToId: Record<string, string> = {}
    for (const x of ja) {
      nameToId[x['name' as keyof typeof x]] = x['_id' as keyof typeof x]
    }
    return nameToId
  }

  async convertAssemblyNameToId(
    namesOrIds: string[],
    verbose = true,
    removeDuplicates = true,
  ): Promise<string[]> {
    const nameToId = await this.assemblyNameToIdDict()
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

  async getAssembly(assemblyNameOrId: string): Promise<AssemblyResponse> {
    if (ObjectId.isValid(assemblyNameOrId)) {
      return this.get(
        `assemblies/${assemblyNameOrId}`,
      ) as Promise<AssemblyResponse>
    }
    const assemblies = (await this.get('assemblies')) as AssemblyResponse[]
    for (const assembly of assemblies) {
      if (
        assembly.name === assemblyNameOrId ||
        assembly.aliases?.includes(assemblyNameOrId)
      ) {
        return assembly
      }
    }
    throw new Error(`Could not find assembly: "${assemblyNameOrId}"`)
  }

  async getRefseqId(
    refseqNameOrId?: string,
    inAssemblyNameOrId?: string,
  ): Promise<string[]> {
    if (refseqNameOrId === undefined && inAssemblyNameOrId === undefined) {
      throw new Error('Please provide refseq and/or assembly')
    }
    inAssemblyNameOrId ??= ''
    let assemblyId: string[] = []
    if (inAssemblyNameOrId !== '') {
      assemblyId = await this.convertAssemblyNameToId([inAssemblyNameOrId])
      if (assemblyId.length !== 1) {
        throw new Error(
          `Assembly name or assembly id returned ${assemblyId.length} assemblies instead of just one`,
        )
      }
    }
    const refSeqs = (await this.get('refSeqs')) as object[]
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

  async getFeatureById(id: string): Promise<AnnotationFeatureSnapshot> {
    return this.get(`features/${id}`) as Promise<AnnotationFeatureSnapshot>
  }

  async deleteAssembly(assemblyId: string): Promise<void> {
    const body: SerializedDeleteAssemblyChange = {
      typeName: 'DeleteAssemblyChange',
      assembly: assemblyId,
    }
    await this.post('changes', JSON.stringify(body))
  }

  async submitAssembly(
    body:
      | SerializedAddAssemblyFromFileChange
      | SerializedAddAssemblyFromExternalChange
      | SerializedAddAssemblyAndFeaturesFromFileChange,
    force: boolean,
  ): Promise<object> {
    let assemblies = (await this.get('assemblies')) as {
      name: string
      _id: string
    }[]
    for (const x of assemblies) {
      const addedAssemblies = 'changes' in body ? body.changes : [body]
      for (const addedAssembly of addedAssemblies) {
        if (x.name === addedAssembly.assemblyName) {
          if (force) {
            await this.deleteAssembly(x._id)
          } else {
            throw new Error(
              `Error: Assembly "${addedAssembly.assemblyName}" already exists`,
            )
          }
        }
      }
    }

    await this.post('changes', JSON.stringify(body))
    assemblies = (await this.get('assemblies')) as {
      name: string
      _id: string
    }[]
    for (const x of assemblies) {
      const addedAssemblies = 'changes' in body ? body.changes : [body]
      for (const addedAssembly of addedAssemblies) {
        if (x.name === addedAssembly.assemblyName) {
          return x
        }
      }
    }
    throw new Error(`Failed to retrieve assembly from ${body.assembly}`)
  }

  async checkNameToIdDict(): Promise<Record<string, string | undefined>> {
    const ja = (await this.get('checks/types')) as CheckResultSnapshot[] // Not sure if CheckResultSnapshot is the right interface
    const nameToId: Record<string, string> = {}
    for (const x of ja) {
      const { _id, name } = x // x['name' as keyof typeof x]
      nameToId[name] = _id // x['_id' as keyof typeof x]
    }
    return nameToId
  }

  async convertCheckNameToId(namesOrIds: string[]): Promise<string[]> {
    const nameToId = await this.checkNameToIdDict()
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

  async getAssemblyFromRefseq(refSeq: string): Promise<string> {
    const refSeqs = (await this.get('refSeqs')) as object[]
    const refJson = filterJsonList(refSeqs, [refSeq], '_id')
    return refJson[0]['assembly' as keyof (typeof refJson)[0]]
  }
}
