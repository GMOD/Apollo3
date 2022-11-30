import { getConf } from '@jbrowse/core/configuration'
import { BaseInternetAccountModel } from '@jbrowse/core/pluggableElementTypes'
import { Region, getSession } from '@jbrowse/core/util'
import { AnnotationFeatureSnapshot } from 'apollo-mst'

import { ChangeManager, SubmitOpts } from '../ChangeManager/ChangeManager'
import { AssemblySpecificChange } from '../ChangeManager/changes/abstract/AssemblySpecificChange'
import {
  Change,
  SerializedChange,
} from '../ChangeManager/changes/abstract/Change'
import { ValidationResultSet } from '../Validations/ValidationSet'
import { BackendDriver } from './BackendDriver'

interface ApolloInternetAccount extends BaseInternetAccountModel {
  baseURL: string
}

export class CollaborationServerDriver extends BackendDriver {
  getInternetAccount(assemblyName?: string, internetAccountId?: string) {
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

  async fetch(
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
      let errorMessage
      try {
        errorMessage = await response.text()
      } catch (error) {
        errorMessage = ''
      }
      throw new Error(
        `getFeatures failed: ${response.status} (${response.statusText})${
          errorMessage ? ` (${errorMessage})` : ''
        }`,
      )
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
  async checkSocket(assembly: string, refSeq: string, internetAccount: any) {
    const { socket, baseURL } = internetAccount
    const token = internetAccount.retrieveToken()
    const channel = `${assembly}-${refSeq}`
    const changeManager = new ChangeManager(this.clientStore)
    const session = getSession(this.clientStore)
    const { notify } = session

    if (!socket.hasListeners(channel)) {
      console.log(`User starts to listen "${channel}" -channel at ${baseURL}`)
      socket.on(
        channel,
        (message: {
          changeSequence: string
          userToken: string
          channel: string
          changeInfo: SerializedChange
          userName: string
        }) => {
          console.log(
            `Channel "${channel}" message: "${JSON.stringify(message)}"`,
          )
          // Save server last change sequnece into session storage
          sessionStorage.setItem('LastChangeSequence', message.changeSequence)
          if (message.userToken !== token && message.channel === channel) {
            const change = Change.fromJSON(message.changeInfo)
            changeManager.submit(change, {
              submitToBackend: false,
            })
            notify(
              `${JSON.stringify(message.userName)} changed : ${JSON.stringify(
                message.changeInfo,
              )}`,
              'success',
            )
          }
          console.log(
            `LastChangeSequence: '${sessionStorage.getItem(
              'LastChangeSequence',
            )}'`,
          )
        },
      )
      socket.on('connect', () => {
        console.log('Connected')
        notify(`You are re-connected to Apollo server.`, 'success')
        this.getLastUpdates(session)
      })
      socket.on('disconnect', function () {
        console.log('Disconnected')
        notify(
          `You are disconnected from Apollo server! Please, close this message`,
          'error',
        )
      })
    }
  }

  /**
   * Start to listen temporary channel, fetch the last changes from server and finally apply those changes to client data store
   * @param apolloInternetAccount - apollo internet account
   * @returns
   */
  async getLastUpdates(internetAccount: any) {
    const lastChangeSequence = sessionStorage.getItem('LastChangeSequence')
    if (!lastChangeSequence) {
      throw new Error(
        `No LastChangeSequence stored in session. Please, refresh you browser to get last updates from server`,
      )
    }
    const { socket } = internetAccount
    const changeManager = new ChangeManager(this.clientStore)
    const session = getSession(this.clientStore)
    const { notify } = session
    const channel = `tmp_${Math.floor(
      Math.random() * (10000 - 1000 + 1) + 1000,
    )}`
    // Let's start to listen temporary channel where server will send the last updates
    socket.on(channel, (message: any) => {
      const change = Change.fromJSON(message.changeInfo[0])
      changeManager.submit(change, { submitToBackend: false })
      notify(
        `Get the last updates from server: ${JSON.stringify(
          message.changeInfo,
        )}`,
        'success',
      )
    })
    const { baseURL } = internetAccount

    const url = new URL('changes', baseURL)
    const searchParams = new URLSearchParams({
      since: lastChangeSequence,
      sort: '1',
    })
    url.search = searchParams.toString()
    const uri = url.toString()
    console.log('Error appears...')
    console.log(`${JSON.stringify(internetAccount)}`)
    const response = await this.fetch(internetAccount, uri, {
      method: 'GET',
    })
    console.log('Error appeared')
    if (!response.ok) {
      console.log(
        `Error when fetching the last updates to recover socket connection — ${response.status}`,
      )
      return
    }

    const serializedChanges = await response.json()
    serializedChanges.forEach((serializedChange: SerializedChange) => {
      const change = Change.fromJSON(serializedChange)
      changeManager.submit(change, { submitToBackend: false })
    })
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
      let errorMessage
      try {
        errorMessage = await response.text()
      } catch (error) {
        errorMessage = ''
      }
      throw new Error(
        `submitChange failed: ${response.status} (${response.statusText})${
          errorMessage ? ` (${errorMessage})` : ''
        }`,
      )
    }
    const results = new ValidationResultSet()
    if (!response.ok) {
      results.ok = false
    }
    return results
  }
}
