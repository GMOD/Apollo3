import { getConf, readConfObject } from '@jbrowse/core/configuration'
import { ConfigurationModel } from '@jbrowse/core/configuration/types'
import { Region, getSession } from '@jbrowse/core/util'
import { LocalPathLocation, UriLocation } from '@jbrowse/core/util/types/mst'
import { ClientDataStore as ClientDataStoreType } from 'apollo-common'
import {
  AnnotationFeature,
  AnnotationFeatureSnapshot,
  ApolloAssembly,
  ApolloRefSeq,
  CheckResult,
  CheckResultSnapshot,
} from 'apollo-mst'
import {
  Instance,
  SnapshotIn,
  SnapshotOut,
  flow,
  getParentOfType,
  getRoot,
  resolveIdentifier,
  types,
} from 'mobx-state-tree'

import {
  ApolloInternetAccount,
  BackendDriver,
  CollaborationServerDriver,
  InMemoryFileDriver,
} from '../BackendDrivers'
import { ChangeManager } from '../ChangeManager'
import ApolloPluginConfigurationSchema from '../config'
import {
  OntologyManagerType,
  OntologyRecordConfiguration,
  TextIndexFieldDefinition,
} from '../OntologyManager'
import { ApolloRootModel } from '../types'

export function clientDataStoreFactory(
  AnnotationFeatureExtended: typeof AnnotationFeature,
) {
  const clientStoreType = types
    .model('ClientDataStore', {
      typeName: types.optional(types.literal('Client'), 'Client'),
      assemblies: types.map(ApolloAssembly),
      checkResults: types.map(CheckResult),
    })
    .views((self) => ({
      get internetAccounts() {
        return getRoot<ApolloRootModel>(self).internetAccounts
      },
      get pluginConfiguration() {
        return getRoot<ApolloRootModel>(self).jbrowse.configuration
          .ApolloPlugin as Instance<typeof ApolloPluginConfigurationSchema>
      },
      getFeature(featureId: string) {
        return resolveIdentifier(
          AnnotationFeatureExtended,
          self.assemblies,
          featureId,
        )
      },
    }))
    .actions((self) => ({
      addAssembly(assemblyId: string) {
        return self.assemblies.put({ _id: assemblyId, refSeqs: {} })
      },
      addFeature(assemblyId: string, feature: AnnotationFeatureSnapshot) {
        const assembly = self.assemblies.get(assemblyId)
        if (!assembly) {
          throw new Error(
            `Could not find assembly "${assemblyId}" to add feature "${feature._id}"`,
          )
        }
        const ref = assembly.refSeqs.get(feature.refSeq)
        if (!ref) {
          throw new Error(
            `Could not find refSeq "${feature.refSeq}" to add feature "${feature._id}"`,
          )
        }
        ref.features.put(feature)
      },
      deleteFeature(featureId: string) {
        const feature = self.getFeature(featureId)
        if (!feature) {
          throw new Error(`Could not find feature "${featureId}" to delete`)
        }
        const { _id, parent } = feature
        if (parent) {
          parent.deleteChild(featureId)
        } else {
          const refSeq = getParentOfType(feature, ApolloRefSeq)
          refSeq.deleteFeature(_id)
        }
      },
      deleteAssembly(assemblyId: string) {
        self.assemblies.delete(assemblyId)
      },
      addCheckResult(checkResult: CheckResultSnapshot) {
        self.checkResults.put(checkResult)
      },
      addCheckResults(checkResults: CheckResultSnapshot[]) {
        for (const checkResult of checkResults) {
          if (!self.checkResults.has(checkResult._id)) {
            self.checkResults.put(checkResult)
          }
        }
      },
    }))
    .volatile((self) => ({
      changeManager: new ChangeManager(self as unknown as ClientDataStoreType),
      collaborationServerDriver: new CollaborationServerDriver(
        self as unknown as ClientDataStoreType,
      ),
      inMemoryFileDriver: new InMemoryFileDriver(
        self as unknown as ClientDataStoreType,
      ),
      ontologyManager: OntologyManagerType.create(),
    }))
    .actions((self) => ({
      afterCreate() {
        // Merge in the ontologies from our plugin configuration.
        // Ontologies of a given name that are already in the session
        // take precedence over the ontologies in the configuration.
        const { ontologyManager, pluginConfiguration } = self
        const configuredOntologies =
          pluginConfiguration.ontologies as ConfigurationModel<
            typeof OntologyRecordConfiguration
          >[]

        for (const ont of configuredOntologies || []) {
          const [name, version, source, indexFields] = [
            readConfObject(ont, 'name') as string,
            readConfObject(ont, 'version') as string,
            readConfObject(ont, 'source') as
              | Instance<typeof LocalPathLocation>
              | Instance<typeof UriLocation>,
            readConfObject(
              ont,
              'textIndexFields',
            ) as TextIndexFieldDefinition[],
          ]
          if (!ontologyManager.findOntology(name)) {
            ontologyManager.addOntology(name, version, source, {
              textIndexing: { indexFields },
            })
          }
        }

        // TODO: add in any configured ontology prefixes that we don't already
        // have in the session (or hardcoded in the model)
      },
    }))
    .views((self) => ({
      getBackendDriver(assemblyId: string) {
        if (!assemblyId) {
          return self.collaborationServerDriver
        }
        const session = getSession(self)
        const { assemblyManager } = session
        const assembly = assemblyManager.get(assemblyId)
        if (!assembly) {
          return self.collaborationServerDriver
        }
        const { internetAccountConfigId } = getConf(assembly, [
          'sequence',
          'metadata',
        ]) as { internetAccountConfigId?: string }
        if (internetAccountConfigId) {
          return self.collaborationServerDriver
        }
        return self.inMemoryFileDriver
      },
      getInternetAccount(assemblyName?: string, internetAccountId?: string) {
        if (!(assemblyName ?? internetAccountId)) {
          throw new Error(
            'Must provide either assemblyName or internetAccountId',
          )
        }
        let configId = internetAccountId
        if (assemblyName && !configId) {
          const { assemblyManager } = getSession(self)
          const assembly = assemblyManager.get(assemblyName)
          if (!assembly) {
            throw new Error(`No assembly found with name ${assemblyName}`)
          }
          ;({ internetAccountConfigId: configId } = getConf(assembly, [
            'sequence',
            'metadata',
          ]) as { internetAccountConfigId: string })
        }
        const { internetAccounts } = self
        const internetAccount = internetAccounts.find(
          (ia) => ia.internetAccountId === configId,
        ) as ApolloInternetAccount | undefined
        if (!internetAccount) {
          throw new Error(
            `No InternetAccount found with config id ${internetAccountId}`,
          )
        }
        return internetAccount
      },
    }))
    .actions((self) => ({
      loadFeatures: flow(function* loadFeatures(regions: Region[]) {
        for (const region of regions) {
          const backendDriver = self.getBackendDriver(region.assemblyName)
          const features = (yield backendDriver.getFeatures(
            region,
          )) as AnnotationFeatureSnapshot[]
          if (features.length === 0) {
            continue
          }
          const { assemblyName, refName } = region
          let assembly = self.assemblies.get(assemblyName)
          if (!assembly) {
            assembly = self.assemblies.put({ _id: assemblyName, refSeqs: {} })
          }
          const [firstFeature] = features
          let ref = assembly.refSeqs.get(firstFeature.refSeq)
          if (!ref) {
            ref = assembly.refSeqs.put({
              _id: firstFeature.refSeq,
              name: refName,
              features: {},
            })
          }
          for (const feature of features) {
            if (!ref.features.has(feature._id)) {
              ref.features.put(feature)
            }
          }
        }
      }),
      loadRefSeq: flow(function* loadRefSeq(regions: Region[]) {
        for (const region of regions) {
          const { refSeq, seq } = yield (
            self as unknown as { backendDriver: BackendDriver }
          ).backendDriver.getSequence(region)
          const { assemblyName, end, refName, start } = region
          let assembly = self.assemblies.get(assemblyName)
          if (!assembly) {
            assembly = self.assemblies.put({ _id: assemblyName, refSeqs: {} })
          }
          let ref = assembly.refSeqs.get(refSeq)
          if (!ref) {
            ref = assembly.refSeqs.put({
              _id: refSeq,
              name: refName,
              sequence: [],
            })
          }
          ref.addSequence({ start, stop: end, sequence: seq })
        }
      }),
    }))

  // assembly and feature data isn't actually reloaded on reload unless we delete it from the snap
  return types.snapshotProcessor(clientStoreType, {
    preProcessor(snap: SnapshotIn<typeof clientStoreType>) {
      snap.assemblies = {}
      return snap
    },
    postProcessor(snap: SnapshotOut<typeof clientStoreType>) {
      snap.assemblies = {}
      return snap
    },
  })
}
