/* eslint-disable @typescript-eslint/no-base-to-string */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import {
  type AssemblySpecificChange,
  Change,
  type FeatureChange,
  isFeatureChange,
} from '@apollo-annotation/common'
import type {
  AnnotationFeatureSnapshot,
  ApolloRefSeqI,
  CheckResultSnapshot,
} from '@apollo-annotation/mst'
import {
  type ChangeMessage,
  ValidationResultSet,
  makeUserSessionId,
} from '@apollo-annotation/shared'
import { getConf } from '@jbrowse/core/configuration'
import type { BaseInternetAccountModel } from '@jbrowse/core/pluggableElementTypes'
import { type Region, getSession } from '@jbrowse/core/util'
import type { Socket } from 'socket.io-client'

import { ChangeManager, type SubmitOpts } from '../ChangeManager'
import { createFetchErrorMessage } from '../util'

import { BackendDriver, type RefNameAliases } from './BackendDriver'

export interface ApolloRefSeqResponse {
  _id: string
  name: string
  description?: string
  aliases: string[]
  length: string
  assembly: string
}

interface RefSeq {
  refName: string
  id: string
  aliases: string[]
}

type RefSeqMap = Map<string, RefSeq>

export interface ApolloInternetAccount extends BaseInternetAccountModel {
  baseURL: string
  socket: Socket
  setLastChangeSequenceNumber(sequenceNumber: number): void
  getMissingChanges(): void
}

export class CollaborationServerDriver extends BackendDriver {
  private inFlight = new Map<string, Promise<string>>()

  private refSeqMaps = new Map<string, RefSeqMap>()

  private async fetch(
    internetAccount: ApolloInternetAccount,
    info: RequestInfo,
    init?: RequestInit,
  ) {
    const customFetch = internetAccount.getFetcher({
      locationType: 'UriLocation',
      uri: info.toString(),
    })
    return customFetch(info, init)
  }

  async searchFeatures(term: string, assemblies: string[]) {
    const internetAccount = this.clientStore.getInternetAccount(
      assemblies[0],
    ) as ApolloInternetAccount
    const { baseURL } = internetAccount

    const url = new URL('features/searchFeatures', baseURL)
    const searchParams = new URLSearchParams({
      assemblies: assemblies.join(','),
      term,
    })
    url.search = searchParams.toString()
    const uri = url.toString()

    const response = await this.fetch(internetAccount, uri)
    if (!response.ok) {
      const errorMessage = await createFetchErrorMessage(
        response,
        'searchFeatures failed',
      )
      throw new Error(errorMessage)
    }
    return response.json() as Promise<AnnotationFeatureSnapshot[]>
  }

  /**
   * Call backend endpoint to get features by criteria
   * @param region -  Searchable region containing refSeq, start and end
   * @returns
   */
  async getFeatures(region: Region) {
    const { assemblyName, end, refName, start } = region
    const { assemblyManager } = getSession(this.clientStore)
    const assembly = assemblyManager.get(assemblyName)
    if (!assembly) {
      throw new Error(`Could not find assembly with name "${assemblyName}"`)
    }
    const refSeqMap = await this.getRefSeqMapping(assemblyName)
    const refSeqEntry = refSeqMap.get(refName)
    if (!refSeqEntry) {
      throw new Error(`Could not find refSeq "${refName}"`)
    }
    const refSeq = refSeqEntry.id
    const internetAccount = this.clientStore.getInternetAccount(
      assemblyName,
    ) as ApolloInternetAccount
    const { baseURL } = internetAccount

    const url = new URL('features/getFeatures', baseURL)
    const searchParams = new URLSearchParams({
      refSeq,
      start: String(start),
      end: String(end),
    })
    url.search = searchParams.toString()
    const uri = url.toString()

    const response = await this.fetch(internetAccount, uri)
    if (!response.ok) {
      const errorMessage = await createFetchErrorMessage(
        response,
        'getFeatures failed',
      )
      throw new Error(errorMessage)
    }
    this.checkSocket(assemblyName, refName, internetAccount)
    return response.json() as Promise<
      [AnnotationFeatureSnapshot[], CheckResultSnapshot[]]
    >
  }

  /**
   * Checks if there is assembly-refSeq specific socket. If not, it opens one
   * @param assembly - assemblyId
   * @param refSeq - refSeqName
   * @param internetAccount - internet account
   */
  checkSocket(
    assembly: string,
    refSeq: string,
    internetAccount: ApolloInternetAccount,
  ) {
    const { socket } = internetAccount
    const token = internetAccount.retrieveToken()
    if (!token) {
      return
    }
    const localSessionId = makeUserSessionId(token)
    const channel = `${assembly}-${refSeq}`
    const changeManager = new ChangeManager(this.clientStore)

    if (!socket.hasListeners(channel)) {
      socket.on(channel, async (message: ChangeMessage) => {
        // Save server last change sequence into session storage
        internetAccount.setLastChangeSequenceNumber(
          Number(message.changeSequence),
        )
        if (message.userSessionId === localSessionId) {
          return // we did this change, no need to apply it again
        }
        const change = Change.fromJSON(message.changeInfo)
        if (isFeatureChange(change) && this.haveDataForChange(change)) {
          await changeManager.submit(change, { submitToBackend: false })
        }
      })
    }
  }

  private haveDataForChange(change: FeatureChange): boolean {
    const { assembly, changedIds } = change
    const apolloAssembly = this.clientStore.assemblies.get(assembly)
    if (!apolloAssembly) {
      return false
    }
    for (const changedId of changedIds) {
      if (this.clientStore.getFeature(changedId)) {
        return true
      }
    }
    return false
  }

  /**
   * Call backend endpoint to get sequence by criteria
   * @param region -  Searchable region containing refSeq, start and end
   * @returns
   */
  async getSequence(region: Region): Promise<{ seq: string; refSeq: string }> {
    const inFlightKey = `${region.refName}:${region.start}-${region.end}`
    const inFlightPromise = this.inFlight.get(inFlightKey)
    const { assemblyName, end, refName, start } = region
    const { assemblyManager } = getSession(this.clientStore)
    const assembly = assemblyManager.get(assemblyName)
    if (!assembly) {
      throw new Error(`Could not find assembly with name "${assemblyName}"`)
    }
    const refSeqMap = await this.getRefSeqMapping(assemblyName)
    const refSeqEntry = refSeqMap.get(refName)
    if (!refSeqEntry) {
      throw new Error(`Could not find refSeq "${refName}"`)
    }
    const refSeq = refSeqEntry.id
    if (inFlightPromise) {
      const seq = await inFlightPromise
      return { seq, refSeq }
    }
    let apolloAssembly = this.clientStore.assemblies.get(assemblyName)
    if (!apolloAssembly) {
      apolloAssembly = this.clientStore.addAssembly(assemblyName)
    }
    let apolloRefSeq = apolloAssembly.refSeqs.get(refSeq)
    if (!apolloRefSeq) {
      apolloRefSeq = apolloAssembly.addRefSeq(refSeq, refName)
    }
    const clientStoreSequence = apolloRefSeq.getSequence(start, end)
    if (clientStoreSequence.length === end - start) {
      return { seq: clientStoreSequence, refSeq }
    }
    const internetAccount = this.clientStore.getInternetAccount(
      assemblyName,
    ) as ApolloInternetAccount
    const { baseURL } = internetAccount

    const url = new URL('sequence', baseURL)
    const searchParams = new URLSearchParams({
      refSeq,
      start: String(start),
      end: String(end),
    })
    url.search = searchParams.toString()
    const uri = url.toString()

    const seqPromise = this.getSeqFromServer(
      internetAccount,
      uri,
      apolloRefSeq,
      start,
      end,
    )
    this.inFlight.set(inFlightKey, seqPromise)
    const seq = await seqPromise
    this.checkSocket(assemblyName, refName, internetAccount)
    this.inFlight.delete(inFlightKey)
    return { seq, refSeq }
  }

  private async getSeqFromServer(
    internetAccount: ApolloInternetAccount,
    uri: string,
    apolloRefSeq: ApolloRefSeqI,
    start: number,
    stop: number,
  ) {
    const response = await this.fetch(internetAccount, uri)
    if (!response.ok) {
      let errorMessage
      try {
        errorMessage = await response.text()
      } catch {
        errorMessage = ''
      }
      throw new Error(
        `getSequence failed: ${response.status} (${response.statusText})${
          errorMessage ? ` (${errorMessage})` : ''
        }`,
      )
    }
    const seq = await response.text()
    apolloRefSeq.addSequence({ sequence: seq, start, stop })
    return seq
  }

  async getRefSeqMapping(assemblyName: string): Promise<RefSeqMap> {
    const cachedRefSeqMap = this.refSeqMaps.get(assemblyName)
    if (cachedRefSeqMap) {
      return cachedRefSeqMap
    }
    const { assemblyManager } = getSession(this.clientStore)
    const assembly = assemblyManager.get(assemblyName)
    if (!assembly) {
      throw new Error(`Could not find assembly with name "${assemblyName}"`)
    }
    const internetAccount = this.clientStore.getInternetAccount(
      assemblyName,
    ) as ApolloInternetAccount
    const { baseURL } = internetAccount
    const url = new URL('refSeqs', baseURL)
    const searchParams = new URLSearchParams({ assembly: assemblyName })
    url.search = searchParams.toString()
    const uri = url.toString()

    const response = await this.fetch(internetAccount, uri)
    if (!response.ok) {
      let errorMessage
      try {
        errorMessage = await response.text()
      } catch {
        errorMessage = ''
      }
      throw new Error(
        `getRefNameAliases failed: ${response.status} (${response.statusText})${
          errorMessage ? ` (${errorMessage})` : ''
        }`,
      )
    }
    const refSeqs = (await response.json()) as ApolloRefSeqResponse[]
    const refSeqMap = new Map<string, RefSeq>(
      refSeqs.map((refSeq) => [
        refSeq.name,
        { refName: refSeq.name, id: refSeq._id, aliases: refSeq.aliases },
      ]),
    )
    this.refSeqMaps.set(assemblyName, refSeqMap)
    return refSeqMap
  }

  async getRefNameAliases(assemblyName: string): Promise<RefNameAliases[]> {
    const refSeqMap = await this.getRefSeqMapping(assemblyName)
    return [...refSeqMap.values()].map((refSeq) => ({
      refName: refSeq.refName,
      aliases: [...new Set([refSeq.id, ...refSeq.aliases])],
      uniqueId: `alias-${refSeq.id}`,
    }))
  }

  async getRefSeqId(assemblyName: string, refName: string) {
    const refSeqMap = await this.getRefSeqMapping(assemblyName)
    if (!refSeqMap) {
      return
    }
    const refSeq = refSeqMap.get(refName)
    return refSeq?.id
  }

  async getRegions(assemblyName: string): Promise<Region[]> {
    const { assemblyManager } = getSession(this.clientStore)
    const assembly = assemblyManager.get(assemblyName)
    if (!assembly) {
      throw new Error(`Could not find assembly with name "${assemblyName}"`)
    }
    const internetAccount = this.clientStore.getInternetAccount(
      assemblyName,
    ) as ApolloInternetAccount
    const { baseURL } = internetAccount
    const url = new URL('refSeqs', baseURL)
    const searchParams = new URLSearchParams({ assembly: assemblyName })
    url.search = searchParams.toString()
    const uri = url.toString()

    const response = await this.fetch(internetAccount, uri)
    if (!response.ok) {
      let errorMessage
      try {
        errorMessage = await response.text()
      } catch {
        errorMessage = ''
      }
      throw new Error(
        `getRegions failed: ${response.status} (${response.statusText})${
          errorMessage ? ` (${errorMessage})` : ''
        }`,
      )
    }
    const refSeqs = await response.json()
    return refSeqs.map((refSeq: { name: string; length: number }) => ({
      refName: refSeq.name,
      start: 0,
      end: refSeq.length,
    }))
  }

  getAssemblies(internetAccountId?: string) {
    const { assemblyManager } = getSession(this.clientStore)
    return assemblyManager.assemblies.filter((assembly) => {
      const sequenceMetadata = getConf(assembly, ['sequence', 'metadata']) as
        | { apollo: boolean; internetAccountConfigId?: string }
        | undefined
      if (
        sequenceMetadata &&
        sequenceMetadata.apollo &&
        sequenceMetadata.internetAccountConfigId
      ) {
        if (internetAccountId) {
          return sequenceMetadata.internetAccountConfigId === internetAccountId
        }
        return true
      }
      return false
    })
  }

  async submitChange(
    change: Change | AssemblySpecificChange,
    opts: SubmitOpts = {},
  ) {
    const { internetAccountId } = opts
    const internetAccount = this.clientStore.getInternetAccount(
      'assembly' in change ? change.assembly : undefined,
      internetAccountId,
    ) as ApolloInternetAccount
    const { baseURL } = internetAccount
    const url = new URL('changes', baseURL).href
    const response = await this.fetch(internetAccount, url, {
      method: 'POST',
      body: JSON.stringify(change.toJSON()),
      headers: { 'Content-Type': 'application/json' },
    })
    if (!response.ok) {
      const errorMessage = await createFetchErrorMessage(
        response,
        'submitChange failed',
      )
      throw new Error(errorMessage)
    }
    const results = new ValidationResultSet()
    if (!response.ok) {
      results.ok = false
    }
    return results
  }
}
