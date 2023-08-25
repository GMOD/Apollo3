import gff, { GFF3Feature, GFF3Sequence } from '@gmod/gff'
import { getConf } from '@jbrowse/core/configuration'
import { BaseInternetAccountModel } from '@jbrowse/core/pluggableElementTypes'
import { Region, getSession, isElectron } from '@jbrowse/core/util'
import { AssemblySpecificChange, Change, SerializedChange } from 'apollo-common'
import { AnnotationFeatureSnapshot } from 'apollo-mst'
import { ValidationResultSet } from 'apollo-shared'
import { nanoid } from 'nanoid'
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

function createFeature(gff3Feature: GFF3Feature): AnnotationFeatureSnapshot {
  const [firstFeature] = gff3Feature
  const {
    seq_id: refName,
    type,
    start,
    end,
    strand,
    score,
    phase,
    child_features: childFeatures,
    source,
    attributes,
  } = firstFeature
  if (!refName) {
    throw new Error(
      `feature does not have seq_id: ${JSON.stringify(firstFeature)}`,
    )
  }
  if (!type) {
    throw new Error(
      `feature does not have type: ${JSON.stringify(firstFeature)}`,
    )
  }
  if (start === null) {
    throw new Error(
      `feature does not have start: ${JSON.stringify(firstFeature)}`,
    )
  }
  if (end === null) {
    throw new Error(
      `feature does not have end: ${JSON.stringify(firstFeature)}`,
    )
  }
  const feature: AnnotationFeatureSnapshot = {
    _id: nanoid(),
    gffId: '',
    refSeq: refName,
    type,
    start,
    end,
  }
  if (gff3Feature.length > 1) {
    feature.discontinuousLocations = gff3Feature.map((f) => {
      const { start: subStart, end: subEnd, phase: locationPhase } = f
      if (subStart === null || subEnd === null) {
        throw new Error(
          `feature does not have start and/or end: ${JSON.stringify(f)}`,
        )
      }
      let parsedPhase: 0 | 1 | 2 | undefined = undefined
      if (locationPhase) {
        if (locationPhase === '0') {
          parsedPhase = 0
        } else if (locationPhase === '1') {
          parsedPhase = 1
        } else if (locationPhase === '2') {
          parsedPhase = 2
        } else {
          throw new Error(`Unknown phase: "${locationPhase}"`)
        }
      }
      return { start: subStart, end: subEnd, phase: parsedPhase }
    })
  }
  if (strand) {
    if (strand === '+') {
      feature.strand = 1
    } else if (strand === '-') {
      feature.strand = -1
    } else {
      throw new Error(`Unknown strand: "${strand}"`)
    }
  }
  if (score !== null) {
    feature.score = score
  }
  if (phase) {
    if (phase === '0') {
      feature.phase = 0
    } else if (phase === '1') {
      feature.phase = 1
    } else if (phase === '2') {
      feature.phase = 2
    } else {
      throw new Error(`Unknown phase: "${phase}"`)
    }
  }

  if (childFeatures?.length) {
    const children: Record<string, AnnotationFeatureSnapshot> = {}
    for (const childFeature of childFeatures) {
      const child = createFeature(childFeature)
      children[child._id] = child
      // Add value to gffId
      child.attributes?._id
        ? (child.gffId = child.attributes?._id.toString())
        : (child.gffId = child._id)
    }
    feature.children = children
  }
  if (source ?? attributes) {
    const attrs: Record<string, string[]> = {}
    if (source) {
      attrs.source = [source]
    }
    if (attributes) {
      Object.entries(attributes).forEach(([key, val]) => {
        if (val) {
          const newKey = key.toLowerCase()
          if (newKey !== 'parent') {
            // attrs[key.toLowerCase()] = val
            switch (key) {
              case 'ID':
                attrs._id = val
                break
              case 'Name':
                attrs.gff_name = val
                break
              case 'Alias':
                attrs.gff_alias = val
                break
              case 'Target':
                attrs.gff_target = val
                break
              case 'Gap':
                attrs.gff_gap = val
                break
              case 'Derives_from':
                attrs.gff_derives_from = val
                break
              case 'Note':
                attrs.gff_note = val
                break
              case 'Dbxref':
                attrs.gff_dbxref = val
                break
              case 'Ontology_term': {
                const goTerms: string[] = []
                const otherTerms: string[] = []
                val.forEach((v) => {
                  if (v.startsWith('GO:')) {
                    goTerms.push(v)
                  } else {
                    otherTerms.push(v)
                  }
                })
                if (goTerms.length) {
                  attrs['Gene Ontology'] = goTerms
                }
                if (otherTerms.length) {
                  attrs.gff_ontology_term = otherTerms
                }
                break
              }
              case 'Is_circular':
                attrs.gff_is_circular = val
                break
              default:
                attrs[key.toLowerCase()] = val
            }
          }
        }
      })
    }
    feature.attributes = attrs
  }
  return feature
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

  async getFeatures(region: Region) {
    const { assemblyName, refName, start, end } = region
    const { assemblyManager } = getSession(this.clientStore)
    const assembly = assemblyManager.get(assemblyName)
    if (!assembly) {
      throw new Error(`Could not find assembly with name "${assemblyName}"`)
    }
    const { file } = getConf(assembly, ['sequence', 'metadata']) as {
      file: string
    }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('fs')
    console.log(`region: ${JSON.stringify(region)}`)

    const fileData = await fs.promises.readFile(file, 'utf-8')
    const featuresAndSequences = gff.parseStringSync(fileData, {
      parseSequences: false,
      parseComments: false,
      parseDirectives: false,
      parseFeatures: true,
    })
    const features: AnnotationFeatureSnapshot[] = []
    for (const seqLine of featuresAndSequences) {
      if (Array.isArray(seqLine)) {
        // regular feature
        features.push(createFeature(seqLine))
      }
    }
    // return features
    const filteredResults = features.filter(
      (feature) =>
        feature.refSeq === refName &&
        feature.start >= start &&
        feature.end <= end,
    )
    return filteredResults
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
    const { file } = getConf(assembly, ['sequence', 'metadata']) as {
      file: string
    }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('fs')
    const filePath =
      '/Users/kyosti/src/Apollo/Assembly_files/volvox.sort.fasta.gff3'

    const fileData = (await fs.promises.readFile(filePath, 'utf-8')
      .text) as string
    const featuresAndSequences = gff.parseStringSync(fileData, {
      parseSequences: true,
      parseComments: false,
      parseDirectives: false,
      parseFeatures: false,
    })
    const result = { seq: fileData, refSeq: refName }
    return { seq: fileData, refSeq: refName }
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
