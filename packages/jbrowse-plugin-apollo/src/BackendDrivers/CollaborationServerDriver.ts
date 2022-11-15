import { getConf } from '@jbrowse/core/configuration'
import { BaseInternetAccountModel } from '@jbrowse/core/pluggableElementTypes'
import { Region, getSession } from '@jbrowse/core/util'
import { AnnotationFeatureSnapshot } from 'apollo-mst'
import {
  AssemblySpecificChange,
  Change,
  SerializedChange,
  ValidationResultSet,
} from 'apollo-shared'
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
  private getInternetAccount(
    assemblyName?: string,
    internetAccountId?: string,
  ) {
    if (!(assemblyName || internetAccountId)) {
      throw new Error('Must provide either assemblyName or internetAccountId')
    }
    let configId = internetAccountId
    if (assemblyName && !configId) {
      const { assemblyManager } = getSession(this.clientStore)
      const assembly = assemblyManager.get(assemblyName)
      if (!assembly) {
        throw new Error(`No assembly found with name ${assemblyName}`)
      }
      ;({ internetAccountConfigId: configId } = getConf(assembly, [
        'sequence',
        'metadata',
      ]) as { internetAccountConfigId: string })
    }
    const { internetAccounts } = this.clientStore
    const internetAccount = internetAccounts.find(
      (ia) => getConf(ia, 'internetAccountId') === configId,
    ) as ApolloInternetAccount | undefined
    if (!internetAccount) {
      throw new Error(
        `No InternetAccount found with config id ${internetAccountId}`,
      )
    }
    return internetAccount
  }

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

  /**
   * Call backend endpoint to get features by criteria
   * @param region -  Searchable region containing refSeq, start and end
   * @returns
   */
  async getFeatures(region: Region) {
    const { assemblyName, refName, start, end } = region
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
    const internetAccount = this.getInternetAccount(assemblyName)
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
    return response.json() as Promise<AnnotationFeatureSnapshot[]>
  }

  /**
   * Checks if there is assembly-refSeq specific socket. If not, it opens one
   * @param assembly - assemblyId
   * @param refSeq - refSeqName
   * @param internetAccount - internet account
   */
  async checkSocket(
    assembly: string,
    refSeq: string,
    internetAccount: ApolloInternetAccount,
  ) {
    const { socket } = internetAccount
    const token = internetAccount.retrieveToken()
    const channel = `${assembly}-${refSeq}`
    const changeManager = new ChangeManager(this.clientStore)
    const session = getSession(this.clientStore)
    const { notify } = session

    if (!socket.hasListeners(channel)) {
      socket.on(
        channel,
        (message: {
          changeSequence: string
          userToken: string
          channel: string
          changeInfo: SerializedChange
          userName: string
        }) => {
          // Save server last change sequnece into session storage
          internetAccount.setLastChangeSequenceNumber(
            Number(message.changeSequence),
          )
          if (message.userToken !== token && message.channel === channel) {
            const change = Change.fromJSON(message.changeInfo)
            changeManager.submit(change, { submitToBackend: false })
          }
        },
      )
      socket.on('reconnect', () => {
        notify('You are re-connected to the Apollo server.', 'success')
        internetAccount.getMissingChanges()
      })
      socket.on('disconnect', () => {
        notify('You are disconnected from the Apollo server.', 'error')
      })
    }
  }

  async getSequence(region: Region) {
    throw new Error('getSequence not yet implemented')
    return ''
  }

  async getRefSeqs() {
    throw new Error('getRefSeqs not yet implemented')
    return []
  }

  async submitChange(
    change: Change | AssemblySpecificChange,
    opts: SubmitOpts = {},
  ) {
    const { internetAccountId = undefined } = opts
    const internetAccount = this.getInternetAccount(
      'assembly' in change ? change.assembly : undefined,
      internetAccountId,
    )
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
