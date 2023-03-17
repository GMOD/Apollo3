import { GFF3Feature } from '@gmod/gff'
import { Region, getSession } from '@jbrowse/core/util'
import { AssemblySpecificChange, Change } from 'apollo-common'
import { ValidationResultSet } from 'apollo-shared'
import ObjectID from 'bson-objectid'

import { SubmitOpts } from '../ChangeManager'
import { ApolloSessionModel } from '../session'
import { BackendDriver } from './BackendDriver'

export class LocalFileDriver extends BackendDriver {
  async getFeatures(region: Region) {
    throw new Error('To be implemented')
    return []
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
  ) {
    const assemblyId = new ObjectID().toHexString()

    const { apolloDataStore } = session
    // const { assemblyManager } = getSession(this.clientStore)
    // console.log(`assemblyManager: ${JSON.stringify(assemblyManager)}`)

    const assemblyConfig = {
      name: assembly,
      aliases: [assembly],
      displayName: assembly,
      backendDriverType: 'LocalFileDriver',
      sequence: {
        trackId: `sequenceConfigId-${assembly}`,
        type: 'ReferenceSequenceTrack',
        adapter: {
          type: 'ApolloSequenceAdapter',
          assemblyId,
          baseURL: { uri: 'baseURL', locationType: 'UriLocation' },
        },
        // metadata: {
        //   internetAccountConfigId:
        //     internetAccount.configuration.internetAccountId,
        //   ids,
        // },
      },
      // refNameAliases: {
      //   adapter: {
      //     type: 'FromConfigAdapter',
      //     features: refNameAliasesFeatures,
      //   },
      // },
    }
    // await assemblyManager.addAssembly(assemblyConfig)

    await session.addAssembly(assemblyConfig)
    console.log(`SESSION: ${JSON.stringify(session.assemblies)}`)

    // await apolloDataStore.addAssembly(assemblyConfig)
    // console.log(`ASSEMBLIES: ${JSON.stringify(apolloDataStore.assemblies)}`)

    // for (const f of features) {
    //   const gff3Feature = f as GFF3Feature
    //   console.log(`FEATURE=${JSON.stringify(gff3Feature)}`)
    //   await session.addFeature(f)
    // }
  }
}
