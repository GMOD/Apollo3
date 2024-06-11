/* eslint-disable @typescript-eslint/no-base-to-string */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { AssemblySpecificChange, Change } from '@apollo-annotation/common'
import {
  AnnotationFeatureSnapshot,
  ApolloRefSeqI,
  CheckResultSnapshot,
} from '@apollo-annotation/mst'
import { ChangeMessage, ValidationResultSet } from '@apollo-annotation/shared'
import { getConf } from '@jbrowse/core/configuration'
import { BaseInternetAccountModel } from '@jbrowse/core/pluggableElementTypes'
import { Region, getSession } from '@jbrowse/core/util'
import { Socket } from 'socket.io-client'

import { ChangeManager, SubmitOpts } from '../ChangeManager'
import { createFetchErrorMessage } from '../util'
import { BackendDriver } from './BackendDriver'

export interface ApolloInternetAccount extends BaseInternetAccountModel {
  baseURL: string
  socket: Socket
  setLastChangeSequenceNumber(sequenceNumber: number): void
  getMissingChanges(): void
}

export class CollaborationServerDriver extends BackendDriver {
  private inFlight = new Map<string, Promise<string>>()

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
    const { ids } = getConf(assembly, ['sequence', 'metadata']) as {
      ids: Record<string, string>
    }
    const refSeq = ids[refName]
    if (!refSeq) {
      throw new Error(`Could not find refSeq "${refName}"`)
    }
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
    const channel = `${assembly}-${refSeq}`
    const changeManager = new ChangeManager(this.clientStore)

    if (!socket.hasListeners(channel)) {
      socket.on(channel, async (message: ChangeMessage) => {
        // Save server last change sequence into session storage
        internetAccount.setLastChangeSequenceNumber(
          Number(message.changeSequence),
        )
        if (message.userSessionId !== token && message.channel === channel) {
          const change = Change.fromJSON(message.changeInfo)
          await changeManager.submit(change, { submitToBackend: false })
        }
      })
    }
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
    const { ids } = getConf(assembly, ['sequence', 'metadata']) as {
      ids: Record<string, string>
    }
    const refSeq = ids[refName]
    if (!refSeq) {
      throw new Error(`Could not find refSeq "${refName}"`)
    }
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
