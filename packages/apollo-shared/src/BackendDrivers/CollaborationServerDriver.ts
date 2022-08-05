import { GFF3FeatureLine } from '@gmod/gff'
import { getConf } from '@jbrowse/core/configuration'
import { BaseInternetAccountModel } from '@jbrowse/core/pluggableElementTypes'
import { Region, getSession } from '@jbrowse/core/util'
import {
  AnnotationFeatureLocationSnapshot,
  AnnotationFeatureSnapshot,
} from 'apollo-mst'

import { Change } from '../ChangeManager/Change'
import { ValidationResultSet } from '../Validations/ValidationSet'
import { BackendDriver, FeaturesForRefNameSnapshot } from './BackendDriver'

interface ApolloFeatureLine extends GFF3FeatureLine {
  // eslint-disable-next-line camelcase
  child_features?: ApolloFeatureLine[][]
  // eslint-disable-next-line camelcase
  derived_features?: ApolloFeatureLine[][]
  featureId: string
}

export class CollaborationServerDriver extends BackendDriver {
  get internetAccount() {
    const { internetAccountConfigId, internetAccounts } = this.clientStore
    const internetAccount = internetAccounts.find(
      (ia) => getConf(ia, 'internetAccountId') === internetAccountConfigId,
    )
    if (!internetAccount) {
      throw new Error(
        `No InternetAccount found with config id ${internetAccountConfigId}`,
      )
    }
    return internetAccount as BaseInternetAccountModel & {
      baseURL: string
    }
  }

  get baseURL() {
    return this.internetAccount.baseURL
  }

  async fetch(info: RequestInfo, init?: RequestInit) {
    const customFetch = this.internetAccount.getFetcher({
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
    const { baseURL } = this
    const url = new URL('features/getFeatures', baseURL)
    const searchParams = new URLSearchParams({
      refSeq: feature.uniqueId,
      start: String(start),
      end: String(end),
    })
    url.search = searchParams.toString()
    const uri = url.toString()
    // console.log(`In CollaborationServerDriver: Query parameters: refName=${refName}, start=${start}, end=${end}`)

    const response = await this.fetch(uri)
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
    const data = (await response.json()) as ApolloFeatureLine[]
    // const backendResult = JSON.stringify(data)
    // console.log(
    //   `In CollaborationServerDriver: Backend endpoint returned=${backendResult}`,
    // )
    const allFeatures = makeFeatures(data, 'volvox')

    return { [refName]: allFeatures[refName] }
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
    const { baseURL } = this
    const url = new URL('changes', baseURL).href
    const response = await this.fetch(url, {
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

function makeFeatures(
  apolloFeatures: ApolloFeatureLine[],
  assemblyName: string,
) {
  const featuresByRefName: FeaturesForRefNameSnapshot = {}
  for (const apolloFeature of apolloFeatures) {
    const convertedFeature = convertFeature(apolloFeature, assemblyName)
    const { refName } = convertedFeature
    let refRecord = featuresByRefName[refName]
    if (!refRecord) {
      refRecord = {}
      featuresByRefName[refName] = refRecord
    }
    refRecord[convertedFeature.id] = convertedFeature
  }
  return featuresByRefName
}

function convertFeature(
  apolloFeature: ApolloFeatureLine,
  assemblyName: string,
): AnnotationFeatureLocationSnapshot {
  if (!apolloFeature.seq_id) {
    throw new Error('Got GFF3 record without an ID')
  }
  if (!apolloFeature.type) {
    throw new Error('Got GFF3 record without a type')
  }
  if (!apolloFeature.start) {
    throw new Error('Got GFF3 record without a start')
  }
  if (!apolloFeature.end) {
    throw new Error('Got GFF3 record without an end')
  }
  const id = apolloFeature.featureId
  if (!id) {
    throw new Error('Apollo feature without featureId encountered')
  }
  const children: Record<string, AnnotationFeatureSnapshot> = {}
  apolloFeature.child_features?.forEach((childFeature) => {
    let childFeatureId: string | undefined = undefined
    const locations: Record<string, AnnotationFeatureLocationSnapshot> = {}
    childFeature.forEach((childFeatureLine) => {
      childFeatureId = childFeatureLine?.attributes?.ID?.[0]
      const childFeat = convertFeature(childFeatureLine, assemblyName)
      locations[childFeat.id] = childFeat
    })
    if (Object.keys(locations).length > 1) {
      if (!childFeatureId) {
        throw new Error('Feature location found without feature ID')
      }
    } else if (!childFeatureId) {
      childFeatureId = `${Object.values(locations)[0].id}-feature`
    }
    children[childFeatureId] = {
      id: childFeatureId,
      type: 'AnnotationFeature',
      locations,
    }
  })
  const newFeature: AnnotationFeatureLocationSnapshot = {
    id,
    type: 'AnnotationFeatureLocation',
    assemblyName,
    refName: apolloFeature.seq_id,
    start: apolloFeature.start,
    end: apolloFeature.end,
    featureType: apolloFeature.type,
  }
  if (Array.from(Object.entries(children)).length) {
    newFeature.children = children
  }
  return newFeature
}
