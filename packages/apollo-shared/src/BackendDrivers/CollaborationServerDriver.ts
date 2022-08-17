import { getConf } from '@jbrowse/core/configuration'
import { BaseInternetAccountModel } from '@jbrowse/core/pluggableElementTypes'
import { Region, getSession } from '@jbrowse/core/util'
import { AnnotationFeatureSnapshot } from 'apollo-mst'

import { Change } from '../ChangeManager/Change'
import { ValidationResultSet } from '../Validations/ValidationSet'
import { BackendDriver } from './BackendDriver'

export class CollaborationServerDriver extends BackendDriver {
  getInternetAccount(assemblyName: string) {
    const { assemblyManager } = getSession(this.clientStore)
    const assembly = assemblyManager.get(assemblyName)
    const { internetAccounts } = this.clientStore
    const { internetAccountConfigId } = getConf(assembly, [
      'sequence',
      'metadata',
    ]) as { internetAccountConfigId: string }
    const internetAccount = internetAccounts.find(
      (ia) => getConf(ia, 'internetAccountId') === internetAccountConfigId,
    )
    if (!internetAccount) {
      throw new Error(
        `No InternetAccount found with config id ${internetAccountConfigId}`,
      )
    }
    return internetAccount
  }

  getBaseURL(assemblyName: string) {
    const internetAccount = this.getInternetAccount(assemblyName)

    const { baseURL } = internetAccount as BaseInternetAccountModel & {
      baseURL: string
    }
    return baseURL
  }

  async fetch(assemblyName: string, info: RequestInfo, init?: RequestInit) {
    const internetAccount = this.getInternetAccount(assemblyName)
    const customFetch = internetAccount.getFetcher({
      locationType: 'UriLocation',
      uri: info.toString(),
    })
    return customFetch(info, init)
  }

  /**
   * Call backend endpoint to get features by criteria
   * @param region -  Searchable region containing refName, start and end
   * @returns
   */
  async getFeatures(region: Region) {
    const { assemblyName, refName, start, end } = region
    const { assemblyManager } = getSession(this.clientStore)
    const assembly = assemblyManager.get(assemblyName)
    if (!assembly) {
      throw new Error(`Could not find assembly with name "${assemblyName}"`)
    }
    const { features } = getConf(assembly, ['sequence', 'adapter']) as {
      features: {
        refName: string
        uniqueId: string
      }[]
    }
    const feature = features.find((f) => f.refName === refName)
    if (!feature) {
      throw new Error(`Could not find refName "${refName}"`)
    }
    const baseURL = this.getBaseURL(assemblyName)
    const url = new URL('features/getFeatures', baseURL)
    const searchParams = new URLSearchParams({
      refSeq: feature.uniqueId,
      start: String(start),
      end: String(end),
    })
    url.search = searchParams.toString()
    const uri = url.toString()
    // console.log(`In CollaborationServerDriver: Query parameters: refName=${refName}, start=${start}, end=${end}`)

    const response = await this.fetch(assemblyName, uri)
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
    const data = (await response.json()) as AnnotationFeatureSnapshot[]
    // const backendResult = JSON.stringify(data)
    // console.log(
    //   `In CollaborationServerDriver: Backend endpoint returned=${backendResult}`,
    // )
    const allFeatures: Record<string, AnnotationFeatureSnapshot> = {}
    data.forEach((f) => {
      allFeatures[f._id] = f
    })

    return { [refName]: allFeatures }
  }

  async getSequence(region: Region) {
    throw new Error('getSequence not yet implemented')
    return ''
  }

  async getRefNames() {
    throw new Error('getRefNames not yet implemented')
    return []
  }

  async submitChange(change: Change) {
    const baseURL = this.getBaseURL(change.assemblyId)
    const url = new URL('changes', baseURL).href
    const response = await this.fetch(change.assemblyId, url, {
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
        `getFeatures failed: ${response.status} (${response.statusText})${
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
