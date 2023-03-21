import { GFF3Feature } from '@gmod/gff'
import { AppRootModel, Region } from '@jbrowse/core/util'
import { AssemblySpecificChange, Change } from 'apollo-common'
import { AnnotationFeatureI, AnnotationFeatureSnapshot } from 'apollo-mst'
import { ValidationResultSet } from 'apollo-shared'
import ObjectID from 'bson-objectid'
import { getRoot } from 'mobx-state-tree'

import { ApolloInternetAccountModel } from '../ApolloInternetAccount/model'
import { SubmitOpts } from '../ChangeManager'
import { RefSeqInterface } from '../components/OpenLocalFile'
import { ApolloSessionModel } from '../session'
import { BackendDriver } from './BackendDriver'

const featureHash: Record<string, AnnotationFeatureI[]> = {}

export class LocalFileDriver extends BackendDriver {
  async getFeatures(region: Region) {
    // throw new Error('To be implemented')
    const getFeat = featureHash[region.assemblyName]
    console.log(`**** FEATURES: ${JSON.stringify(getFeat)}`)
    return getFeat as unknown as AnnotationFeatureSnapshot[]
  }

  async getSequence(region: Region) {
    throw new Error('To be implemented')
    return ''
  }

  async getRefSeqs() {
    throw new Error('To be implemented')
    return []
  }

  async submitChange(
    change: Change | AssemblySpecificChange,
    opts: SubmitOpts = {},
  ) {
    throw new Error('To be implemented')
    return new ValidationResultSet()
  }

  async saveFeatures(
    features: GFF3Feature[],
    assembly: string,
    session: ApolloSessionModel,
    refsArray: RefSeqInterface[],
  ) {
    const assemblyId = new ObjectID().toHexString()
    console.log(`*** NEW ASSEMBLY ID: ${assemblyId}`)

    const { internetAccounts } = getRoot(session) as AppRootModel
    const internetAccount = internetAccounts[0] as ApolloInternetAccountModel
    const ids: Record<string, string> = {}
    refsArray.forEach((element) => {
      ids[element.refName] = element.aliases![0]
    })
    const assemblyConfig = {
      name: assemblyId,
      aliases: [assembly],
      displayName: assembly,
      backendDriverType: 'LocalFileDriver',
      sequence: {
        trackId: `sequenceConfigId-${assembly}`,
        type: 'ReferenceSequenceTrack',
        adapter: {
          type: 'ApolloSequenceAdapter',
          assemblyId,
          baseURL: {
            locationType: 'UriLocation',
            uri: 'http://localhost:3999',
          },
        },
        metadata: {
          internetAccountConfigId:
            internetAccount.configuration.internetAccountId,
          ids,
        },
      },
      refNameAliases: {
        adapter: {
          type: 'FromConfigAdapter',
          features: refsArray,
        },
      },
    }
    console.log(
      `*** LOCALFILEDRIVER.TS: refNameAliasesFeatures: ${JSON.stringify(
        refsArray,
      )}`,
    )

    // Save assembly into session
    await session.addAssembly(assemblyConfig)
    console.log(`SESSION: ${JSON.stringify(session)}`)
    console.log(`ASSEMBLIES IN SESSION: ${JSON.stringify(session.assemblies)}`)

    const featuresWithId: AnnotationFeatureI[] = []
    for (const f3 of features) {
      const annotationFeature = f3 as unknown as AnnotationFeatureI
      featuresWithId.push({
        ...annotationFeature,
        _id: new ObjectID().toHexString(),
      })
    }

    // Save features into local hash with _id
    featureHash[assembly] = featuresWithId
  }
}
