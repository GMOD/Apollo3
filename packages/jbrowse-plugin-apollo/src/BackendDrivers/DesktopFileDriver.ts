/* eslint-disable @typescript-eslint/no-explicit-any */
import gff, {
  GFF3Feature,
  GFF3FeatureLine,
  GFF3FeatureLineWithRefs,
  GFF3Sequence,
} from '@gmod/gff'
import { GFF3Attributes, GFF3Item } from '@gmod/gff/dist/util'
import { getConf } from '@jbrowse/core/configuration'
import { BaseInternetAccountModel } from '@jbrowse/core/pluggableElementTypes'
import { Region, getSession, isElectron } from '@jbrowse/core/util'
import { AssemblySpecificChange, Change, SerializedChange } from 'apollo-common'
import { AnnotationFeatureI, AnnotationFeatureSnapshot } from 'apollo-mst'
import { ValidationResultSet } from 'apollo-shared'
import { values } from 'mobx'
import { nanoid } from 'nanoid'
import { Socket } from 'socket.io-client'

import { ChangeManager, SubmitOpts } from '../ChangeManager'
import { ApolloSession } from '../session'
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
    return []
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
    console.log('**** IT NEVER COMES HERE TO READ SEQUENCE **** ')
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
    const newFileName = `${file}_001.gff3`
    let commentsOfGFF3 = ''
    let headersOfGFF3 = '##gff-version 3\n'
    let featuresOfGFF3 = ''
    let fastaOfGFF3 = '##FASTA\n'
    let wholeGFF3 = ''
    const gff3Items: GFF3Item[] = [{ directive: 'gff-version', value: '3' }]
    const assemblyName = this.clientStore.assemblies
    // console.log(`*** ASSEMBLY DATA: ${JSON.stringify(assemblyName)}`)

    const { util } = gff
    assemblyName.forEach((valueAssembly, keyAssembly) => {
      if (valueAssembly.comments) {
        commentsOfGFF3 += `${valueAssembly.comments}\n`
      }
      valueAssembly.refSeqs.forEach((valRefSeq, keyRefSeq) => {
        const refSeqName = valRefSeq.name
        valRefSeq.features.forEach((valFeature, keyFeature) => {
          // console.log(`Feature: ${JSON.stringify(val2)}`)
          const attr: GFF3Attributes = {}
          // let sourceValue = ''
          // valFeature.attributes.forEach((valAttribute, keyAttribute) => {
          //   // console.log(`Attribute KEY: "${keyAttr}", VALUE: "${valAttr}"`)
          //   switch (keyAttribute) {
          //     case '_id':
          //       keyAttribute = 'ID'
          //       break
          //     case 'gff_name':
          //       keyAttribute = 'Name'
          //       break
          //     case 'gff_alias':
          //       keyAttribute = 'Alias'
          //       break
          //     case 'gff_target':
          //       keyAttribute = 'Target'
          //       break
          //     case 'gff_gap':
          //       keyAttribute = 'Gap'
          //       break
          //     case 'gff_derives_from':
          //       keyAttribute = 'Derives_from'
          //       break
          //     case 'gff_note':
          //       keyAttribute = 'Note'
          //       break
          //     case 'gff_dbxref':
          //       keyAttribute = 'Dbxref'
          //       break
          //     case 'gff_is_circular':
          //       keyAttribute = 'Is_circular'
          //       break
          //     default:
          //       break
          //   }
          //   if (keyAttribute.toUpperCase() === 'SOURCE') {
          //     sourceValue = valAttribute as unknown as string
          //   } else {
          //     attr[keyAttribute] = valAttribute
          //   }
          // })
          let strand: string | null = null
          if (valFeature.strand) {
            if (valFeature.strand === 1) {
              strand = '+'
            } else if (valFeature.strand === -1) {
              strand = '-'
            }
          }
          let score: number | null = null
          if (valFeature.score) {
            score = valFeature.score
          }
          const phase: string | null = valFeature.phase
            ? (valFeature.phase as unknown as string)
            : null

          // const locations = valFeature.discontinuousLocations?.length
          //   ? valFeature.discontinuousLocations
          //   : [
          //       {
          //         start: valFeature.start,
          //         end: valFeature.end,
          //         phase,
          //       },
          //     ]
          // *******

          // *******
          // console.log(`ATTRIBUTES: ${JSON.stringify(valFeature.attributes)}`)
          // // *** TÄHÄN EHKÄ PITÄÄ LAITTAA FUNKTIO KUTSUÖ makeGFF3Feature() niinkuin "features.services.ts" luokassa
          const featureLine0 = this.makeGFF3Feature(
            valFeature,
            // valFeature.refSeq,
          )
          gff3Items.push(this.makeGFF3Feature(valFeature, ))
          // const featureLine: GFF3FeatureLineWithRefs = {
          //   seq_id: valFeature.refSeq,
          //   start: valFeature.start,
          //   source: sourceValue,
          //   type: valFeature.type,
          //   end: valFeature.end,
          //   score,
          //   strand,
          //   phase,
          //   attributes: attr,
          //   child_features: valFeature.children as unknown as GFF3Feature[],
          //   derived_features:
          //     valFeature.discontinuousLocations as unknown as GFF3Feature[],
          //   // derived_features: ** EMPTY ARRAY **/valFeature.discontinuousLocations as unknown as GFF3Feature[]
          // }

          // const featureLine01 = this.makeGFF3Feature(
          //   featureLine,
          //   valFeature.refSeq,
          // )
          // const featureLineAsString = util.formatFeature([featureLine]) // SHOULD WE USE formatFeature or formatItem ???
          // const featureLineAsString = util.formatFeature([featureLine])
          const featureLineAsString = util.formatFeature(featureLine0)
          if (valFeature.start > 17399 && valFeature.end < 23001) {
            console.log(`Feature line: ${JSON.stringify(valFeature)}`)
            console.log(`A Feature line: ${JSON.stringify(featureLine0)}`)
            console.log(
              `B Feature line: ${JSON.stringify(
                util.formatFeature(featureLine0),
              )}`,
            )
            console.log(
              `C Feature line: ${JSON.stringify(
                util.formatItem(featureLine0),
              )}`,
            )
            console.log(`D Feature line: ${featureLineAsString}`)
            console.log(
              `discontinuousLocations: ${JSON.stringify(
                valFeature.discontinuousLocations,
              )}`,
            )
          }
          // const featureLineAsString = util.formatFeature([featureLine01])
          featuresOfGFF3 += featureLineAsString
          // console.log(`Feature line: ${featureLineAsString}`)
        })
        valRefSeq.sequence.forEach((valSeq, keySeq) => {
          headersOfGFF3 += `##sequence-region ${refSeqName} 1 ${valSeq.stop}\n`
          const gff3Seq: GFF3Sequence = {
            id: refSeqName,
            description: refSeqName,
            sequence: valSeq.sequence,
          }
          fastaOfGFF3 += util.formatSequence(gff3Seq)
        })
      })
    })
    const gff3 = gff.formatSync(gff3Items)
    // console.log(`RESULT: ${JSON.stringify(gff3)}`)
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

  // makeGFF3Feature1(
  //   feature: AnnotationFeatureI,
  //   parentId?: string,
  // ): GFF3Feature {
  //   const locations = feature.discontinuousLocations?.length
  //     ? feature.discontinuousLocations
  //     : [
  //         {
  //           start: feature.start,
  //           end: feature.end,
  //           phase: feature.phase,
  //         },
  //       ]
  //   const attributes: Record<string, string[]> = {
  //     ...(feature.attributes ? getSnapshot(feature.attributes) : {}),
  //   }
  //   const ontologyTerms: string[] = []
  //   const source = feature.attributes?.get('source')?.[0] ?? null
  //   delete attributes.source
  //   if (parentId) {
  //     attributes.Parent = [parentId]
  //   }
  //   if (attributes._id) {
  //     attributes.ID = attributes._id
  //     delete attributes._id
  //   }
  //   if (attributes.gff_name) {
  //     attributes.Name = attributes.gff_name
  //     delete attributes.gff_name
  //   }
  //   if (attributes.gff_alias) {
  //     attributes.Alias = attributes.gff_alias
  //     delete attributes.gff_alias
  //   }
  //   if (attributes.gff_target) {
  //     attributes.Target = attributes.gff_target
  //     delete attributes.gff_target
  //   }
  //   if (attributes.gff_gap) {
  //     attributes.Gap = attributes.gff_gap
  //     delete attributes.gff_gap
  //   }
  //   if (attributes.gff_derives_from) {
  //     attributes.Derives_from = attributes.gff_derives_from
  //     delete attributes.gff_derives_from
  //   }
  //   if (attributes.gff_note) {
  //     attributes.Note = attributes.gff_note
  //     delete attributes.gff_note
  //   }
  //   if (attributes.gff_dbxref) {
  //     attributes.Dbxref = attributes.gff_dbxref
  //     delete attributes.gff_dbxref
  //   }
  //   if (attributes.gff_is_circular) {
  //     attributes.Is_circular = attributes.gff_is_circular
  //     delete attributes.gff_is_circular
  //   }
  //   if (attributes.gff_ontology_term) {
  //     ontologyTerms.push(...attributes.gff_ontology_term)
  //     delete attributes.gff_ontology_term
  //   }
  //   if (attributes['Gene Ontology']) {
  //     ontologyTerms.push(...attributes['Gene Ontology'])
  //     delete attributes['Gene Ontology']
  //   }
  //   if (attributes['Sequence Ontology']) {
  //     ontologyTerms.push(...attributes['Sequence Ontology'])
  //     delete attributes['Sequence Ontology']
  //   }
  //   if (ontologyTerms.length) {
  //     attributes.Ontology_term = ontologyTerms
  //   }
  //   return locations.map((location) => {
  //     const featureLine: GFF3FeatureLineWithRefs = {
  //       start: location.start,
  //       end: location.end,
  //       seq_id: feature.refSeq,
  //       source,
  //       type: feature.type,
  //       score: feature.score ?? null,
  //       strand: feature.strand ? (feature.strand === 1 ? '+' : '-') : null,
  //       phase:
  //         location.phase === 0
  //           ? '0'
  //           : location.phase === 1
  //           ? '1'
  //           : location.phase === 2
  //           ? '2'
  //           : null,
  //       attributes: Object.keys(attributes).length ? attributes : null,
  //       derived_features: [],
  //       child_features: [],
  //     }
  //     if (feature.children && feature.children.size > 0) {
  //       featureLine.child_features = values(feature.children).map((child) => {
  //         return makeGFF3Feature1(
  //           child as unknown as AnnotationFeatureI,
  //           attributes.ID[0],
  //         )
  //       })
  //     }
  //     return featureLine
  //   })
  // }

  makeGFF3Feature(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    featureDocument: any,
    // refSeqName: string,
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

    // console.log(`GFF ATTRIBUTE _id: ${JSON.stringify(attributes._id)}`)
    const ontologyTerms: string[] = []
    // const source = featureDocument.attributes?.source?.[0] ?? null
    let source: any = null
    // let parentId: any = null
    if (featureDocument.attributes) {
      source = JSON.parse(JSON.stringify(featureDocument.attributes)).source?.[0]
    }
    if (featureDocument.attributes) {
      console.log(`*** PARENT: ${JSON.parse(JSON.stringify(featureDocument.attributes)).parent?.[0]}`)
    }
    if (parentId) {
      console.log(`*** PARENTTI OLI: ${parentId}`)
    }
    let featId = ''
    if (featureDocument.attributes) {
      featId  = JSON.parse(JSON.stringify(featureDocument.attributes))._id?.[0]
      console.log(`*** FEATURE ID ${featId}`)
    }
    // const source = featureDocument.attributes?.source?.[0] ?? null

    if (featureDocument.start > 17399 && featureDocument.end < 23001) {
      console.log(`1 attributes: ${JSON.stringify(featureDocument.attributes)}`)
      console.log(`2 locations: ${JSON.stringify(locations)}`)
      console.log(`3 children: ${JSON.stringify(featureDocument.children)}`)
      console.log(`4 source: ${source}`)
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

    // return locations.map(
    //   // eslint-disable-next-line @typescript-eslint/no-explicit-any
    //   (location: any) => ({
    //     start: location.start,
    //     end: location.end,
    //     seq_id: refSeqName,
    //     source,
    //     type: featureDocument.type,
    //     score: featureDocument.score ?? null,
    //     strand: featureDocument.strand
    //       ? featureDocument.strand === 1
    //         ? '+'
    //         : '-'
    //       : null,
    //     phase:
    //       location.phase === 0
    //         ? '0'
    //         : location.phase === 1
    //         ? '1'
    //         : location.phase === 2
    //         ? '2'
    //         : null,
    //     attributes: Object.keys(attributes).length ? attributes : null,
    //     derived_features: [],
    //     // child_features: featureDocument.children
    //     //   ? Object.values(featureDocument.children).map((child) =>
    //     //       this.makeGFF3Feature(child, refSeqName, attributes.ID[0]),
    //     //     )
    //     //   : [],
    //   }),
    // )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        featureLine.child_features = values(featureDocument.children).map(
          (child: any) => {
            return this.makeGFF3Feature(
              child as unknown as AnnotationFeatureI,
              featId,
              // attributes.ID[0],
            )
          },
        )
      }
      return featureLine
    })
  }
}
