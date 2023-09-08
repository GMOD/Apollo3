/* eslint-disable @typescript-eslint/no-explicit-any */
import gff, { GFF3FeatureLineWithRefs, GFF3Sequence } from '@gmod/gff'
import { getConf } from '@jbrowse/core/configuration'
import { BaseInternetAccountModel } from '@jbrowse/core/pluggableElementTypes'
import { getSession } from '@jbrowse/core/util'
import { AssemblySpecificChange, Change } from 'apollo-common'
import { AnnotationFeatureI, AnnotationFeatureSnapshot } from 'apollo-mst'
import { ValidationResultSet } from 'apollo-shared'
import { values } from 'mobx'
import { Socket } from 'socket.io-client'

import { createFetchErrorMessage } from '../util'
import { BackendDriver } from './BackendDriver'

export interface ApolloInternetAccount extends BaseInternetAccountModel {
  baseURL: string
  socket: Socket
  setLastChangeSequenceNumber(sequenceNumber: number): void
  getMissingChanges(): void
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

  async getFeatures() {
    return []
  }

  /**
   * Call backend endpoint to get sequence by criteria
   * @param region -  Searchable region containing refSeq, start and end
   * @returns
   */
  // async getSequence(region: Region): Promise<{ seq: string; refSeq: string }> {
  async getSequence() {
    return { seq: '', refSeq: '' }
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

  async submitChange(change: Change | AssemblySpecificChange) {
    const tmpObj = JSON.parse(JSON.stringify(change.toJSON()))
    const { assemblyManager } = getSession(this.clientStore)
    const assembly = assemblyManager.get(tmpObj.assembly)
    if (!assembly) {
      throw new Error(`Could not find assembly with name "${tmpObj.assembly}"`)
    }
    const { file } = getConf(assembly, ['sequence', 'metadata']) as {
      file: string
    }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('fs')
    const newFileName = `${file}_exported.gff3` // *** HERE WE MUST USE NAME OF ORIGINAL FILE. THIS IS ONLY FOR TEST PURPOSE
    let commentsOfGFF3 = ''
    let headersOfGFF3 = '##gff-version 3\n'
    let featuresOfGFF3 = ''
    let fastaOfGFF3 = '##FASTA\n'
    let wholeGFF3 = ''
    const assemblyName = this.clientStore.assemblies
    const { util } = gff
    assemblyName.forEach((valueAssembly) => {
      if (valueAssembly.comments) {
        commentsOfGFF3 += `${valueAssembly.comments}\n`
      }
      valueAssembly.refSeqs.forEach((valRefSeq) => {
        const refSeqName = valRefSeq.name
        valRefSeq.features.forEach((valFeature) => {
          const featureLine = this.makeGFF3Feature(valFeature)
          const featureLineAsString = util.formatFeature(featureLine)

          featuresOfGFF3 += featureLineAsString
        })
        valRefSeq.sequence.forEach((valSeq) => {
          headersOfGFF3 += `##sequence-region ${refSeqName} 1 ${valSeq.stop}\n`
          const gff3Seq: GFF3Sequence = {
            id: refSeqName,
            description: valSeq.description,
            sequence: valSeq.sequence,
          }
          fastaOfGFF3 += util.formatSequence(gff3Seq)
        })
      })
    })
    if (commentsOfGFF3) {
      const parts = commentsOfGFF3.split(',')
      const resultString = parts.map((part) => `# ${part}`).join('\n')
      wholeGFF3 = resultString
    }
    wholeGFF3 += headersOfGFF3
    wholeGFF3 += featuresOfGFF3
    wholeGFF3 += fastaOfGFF3

    await fs.promises.writeFile(newFileName, wholeGFF3, 'utf-8')

    const results = new ValidationResultSet()
    return results
  }

  makeGFF3Feature(
    featureDocument: any,
    parentId?: string,
  ): GFF3FeatureLineWithRefs[] {
    const locations = featureDocument.discontinuousLocations?.length
      ? featureDocument.discontinuousLocations
      : [
          {
            start: featureDocument.start,
            end: featureDocument.end,
            phase: featureDocument.phase,
          },
        ]

    const attributes: Record<string, string[]> = featureDocument.attributes
      ? JSON.parse(JSON.stringify(featureDocument.attributes))
      : {}

    const ontologyTerms: string[] = []
    let source: any = null
    if (featureDocument.attributes) {
      source = JSON.parse(JSON.stringify(featureDocument.attributes))
        .source?.[0]
    }
    let featId = ''
    if (featureDocument.attributes) {
      featId = JSON.parse(JSON.stringify(featureDocument.attributes))._id?.[0]
    }

    delete attributes.source
    if (parentId) {
      attributes.Parent = [parentId]
    }
    if (attributes._id) {
      attributes.ID = attributes._id
      delete attributes._id
    }
    if (attributes.gff_name) {
      attributes.Name = attributes.gff_name
      delete attributes.gff_name
    }
    if (attributes.gff_alias) {
      attributes.Alias = attributes.gff_alias
      delete attributes.gff_alias
    }
    if (attributes.gff_target) {
      attributes.Target = attributes.gff_target
      delete attributes.gff_target
    }
    if (attributes.gff_gap) {
      attributes.Gap = attributes.gff_gap
      delete attributes.gff_gap
    }
    if (attributes.gff_derives_from) {
      attributes.Derives_from = attributes.gff_derives_from
      delete attributes.gff_derives_from
    }
    if (attributes.gff_note) {
      attributes.Note = attributes.gff_note
      delete attributes.gff_note
    }
    if (attributes.gff_dbxref) {
      attributes.Dbxref = attributes.gff_dbxref
      delete attributes.gff_dbxref
    }
    if (attributes.gff_is_circular) {
      attributes.Is_circular = attributes.gff_is_circular
      delete attributes.gff_is_circular
    }
    if (attributes.gff_ontology_term) {
      ontologyTerms.push(...attributes.gff_ontology_term)
      delete attributes.gff_ontology_term
    }
    if (attributes['Gene Ontology']) {
      ontologyTerms.push(...attributes['Gene Ontology'])
      delete attributes['Gene Ontology']
    }
    if (attributes['Sequence Ontology']) {
      ontologyTerms.push(...attributes['Sequence Ontology'])
      delete attributes['Sequence Ontology']
    }
    if (ontologyTerms.length) {
      attributes.Ontology_term = ontologyTerms
    }
    return locations.map((location: any) => {
      const featureLine: GFF3FeatureLineWithRefs = {
        start: location.start,
        end: location.end,
        seq_id: featureDocument.refSeq,
        source,
        type: featureDocument.type,
        score: featureDocument.score ?? null,
        strand: featureDocument.strand
          ? featureDocument.strand === 1
            ? '+'
            : '-'
          : null,
        phase:
          location.phase === 0
            ? '0'
            : location.phase === 1
            ? '1'
            : location.phase === 2
            ? '2'
            : null,
        attributes: Object.keys(attributes).length ? attributes : null,
        derived_features: [],
        child_features: [],
      }
      if (featureDocument.children && featureDocument.children.size > 0) {
        featureLine.child_features = values(featureDocument.children).map(
          (child: any) => {
            return this.makeGFF3Feature(
              child as unknown as AnnotationFeatureI,
              featId,
            )
          },
        )
      }
      return featureLine
    })
  }
}
