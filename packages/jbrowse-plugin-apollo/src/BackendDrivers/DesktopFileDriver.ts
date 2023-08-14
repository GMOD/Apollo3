import { getConf } from '@jbrowse/core/configuration'
import { BaseInternetAccountModel } from '@jbrowse/core/pluggableElementTypes'
import { Region, getSession, isElectron } from '@jbrowse/core/util'
import { AssemblySpecificChange, Change, SerializedChange } from 'apollo-common'
import { AnnotationFeatureSnapshot } from 'apollo-mst'
import { ValidationResultSet } from 'apollo-shared'
import { Socket } from 'socket.io-client'

import { ChangeManager, SubmitOpts } from '../ChangeManager'
import { createFetchErrorMessage } from '../util'
import { BackendDriver } from './BackendDriver'
import fs from 'fs'


export interface ApolloInternetAccount extends BaseInternetAccountModel {
  baseURL: string
  socket: Socket
  setLastChangeSequenceNumber(sequenceNumber: number): void
  getMissingChanges(): void
}

    // place these somewhere above your components, below the imports
// we need to ensure we're running on electron to load in this node package
// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-empty-function
const exec = isElectron ? require('child_process').exec : () => {}

// runs the exec function
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function execute(command: any, callback: any) {
  console.log(`Execute alkaa: "${command}"`)
  console.log(`isElectron: "${isElectron}"`)
  console.log(`exec: "${exec}"`)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  exec(command, (error: any, stdout: any, stderr: any) => {
    console.log`error: ${error}`
    console.log`out: ${stdout}`
    console.log`stder: ${stderr}`
    callback(stdout)
  })
  console.log('Execute loppuu')
}

export class DesktopFileDriver extends BackendDriver {

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
    const { assemblyName, refName, start, end } = region
    const { assemblyManager } = getSession(this.clientStore)
    const assembly = assemblyManager.get(assemblyName)
    if (!assembly) {
      throw new Error(`Could not find assembly with name "${assemblyName}"`)
    }
    const { ids } = getConf(assembly, ['sequence', 'metadata']) as {
      ids: Record<string, string>
    }
    //************* NEW CODE BEGIN */
    // MITEN SUORITETAAN EXECUTE -TÄÄLLÄ???
    // MUUTEN EI VARMAAN PÄÄSE PAIKALLISEN KONEEN TIEDOSTOIHIN KIINNI???
    const { apollo, file } = getConf(assembly, ['sequence', 'metadata'])
    //console.log(`Apollo: ${JSON.stringify(apollo)}`)
    //console.log(`Filename: ${JSON.stringify(file)}`)
    const demoFilename = 'volvoxV1.sort_validation.gff3'
    console.log(`demoFilename: ${JSON.stringify(demoFilename)}`)
    // if (!file) {
    //   throw new Error('Could not get local filename')
    // }
    const teksti = 'mitapa tassa'
    const tiedosto = '/Users/kyosti/src/Apollo/Assembly_files/OMAFILE_2.txt'
    execute(
      // `echo ${teksti} > ${tiedosto}`,
      `date > ${tiedosto}`,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
      (output: any) => {
        console.log('**************** TOIMIII ****************** ')
      },
    )
    console.log('All done')
    //************ END */
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
    await this.checkSocket(assemblyName, refName, internetAccount)
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
        async (message: {
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
            await changeManager.submit(change, { submitToBackend: false })
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

  /**
   * Call backend endpoint to get sequence by criteria
   * @param region -  Searchable region containing refSeq, start and end
   * @returns
   */
  async getSequence(region: Region): Promise<{ seq: string; refSeq: string }> {
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
    const internetAccount = this.clientStore.getInternetAccount(
      assemblyName,
    ) as ApolloInternetAccount
    const { baseURL } = internetAccount

    const url = new URL('refSeqs/getSequence', baseURL)
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
        `getSequence failed: ${response.status} (${response.statusText})${
          errorMessage ? ` (${errorMessage})` : ''
        }`,
      )
    }
    await this.checkSocket(assemblyName, refName, internetAccount)
    // const seq = (await response.text()) as string
    // return seq as string
    return { seq: await response.text(), refSeq }
  }

  async getRefSeqs() {
    throw new Error('getRefSeqs not yet implemented')
    return []
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
    const { internetAccountId = undefined } = opts
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
