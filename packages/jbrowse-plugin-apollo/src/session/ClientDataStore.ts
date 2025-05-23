/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { type ClientDataStore as ClientDataStoreType } from '@apollo-annotation/common'
import {
  type AnnotationFeatureModel,
  type AnnotationFeatureSnapshot,
  ApolloAssembly,
  type ApolloAssemblySnapshot,
  ApolloRefSeq,
  type BackendDriverType,
  CheckResult,
  type CheckResultSnapshot,
} from '@apollo-annotation/mst'
import { getConf, readConfObject } from '@jbrowse/core/configuration'
import { type ConfigurationModel } from '@jbrowse/core/configuration/types'
import { type Region, getSession, isElectron } from '@jbrowse/core/util'
import {
  type LocalPathLocation,
  type UriLocation,
} from '@jbrowse/core/util/types/mst'
import { autorun } from 'mobx'
import {
  type Instance,
  addDisposer,
  flow,
  getParentOfType,
  getRoot,
  resolveIdentifier,
  types,
} from 'mobx-state-tree'

import {
  type ApolloInternetAccount,
  CollaborationServerDriver,
  DesktopFileDriver,
  InMemoryFileDriver,
} from '../BackendDrivers'
import { ChangeManager } from '../ChangeManager'
import {
  OntologyManagerType,
  type OntologyRecordConfiguration,
  type TextIndexFieldDefinition,
} from '../OntologyManager'
import type ApolloPluginConfigurationSchema from '../config'
import { type ApolloRootModel } from '../types'

import { type ApolloSessionModel } from './session'

export function clientDataStoreFactory(
  AnnotationFeatureExtended: typeof AnnotationFeatureModel,
) {
  return types
    .model('ClientDataStore', {
      typeName: types.optional(types.literal('Client'), 'Client'),
      assemblies: types.map(ApolloAssembly),
      checkResults: types.map(CheckResult),
      ontologyManager: types.optional(OntologyManagerType, {}),
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
      addAssembly(assemblyId: string, backendDriverType?: BackendDriverType) {
        const assemblySnapshot: ApolloAssemblySnapshot = {
          _id: assemblyId,
          refSeqs: {},
        }
        if (backendDriverType) {
          assemblySnapshot.backendDriverType = backendDriverType
        }
        return self.assemblies.put(assemblySnapshot)
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
      deleteCheckResult(checkResultId: string) {
        self.checkResults.delete(checkResultId)
      },
      clearCheckResults() {
        self.checkResults.clear()
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
      desktopFileDriver: isElectron
        ? new DesktopFileDriver(self as unknown as ClientDataStoreType)
        : undefined,
    }))
    .actions((self) => ({
      afterCreate() {
        addDisposer(
          self,
          autorun(() => {
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
                const session = getSession(
                  self,
                ) as unknown as ApolloSessionModel
                const { jobsManager } = session
                const controller = new AbortController()
                const jobName = `Loading ontology "${name}"`
                const job = {
                  name: jobName,
                  statusMessage: `Loading ontology "${name}", version "${version}", this may take a while`,
                  progressPct: 0,
                  cancelCallback: () => {
                    controller.abort()
                    jobsManager.abortJob(job.name)
                  },
                }
                const update = (message: string, progress: number): void => {
                  if (progress === 0) {
                    jobsManager.runJob(job)
                    return
                  }
                  if (progress === 100) {
                    jobsManager.done(job)
                    return
                  }
                  jobsManager.update(jobName, message, progress)
                  return
                }
                ontologyManager.addOntology(name, version, source, {
                  textIndexing: { indexFields },
                  update,
                })
              }
            }
            // TODO: add in any configured ontology prefixes that we don't already
            // have in the session (or hardcoded in the model)
          }),
        )
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
        const { file, internetAccountConfigId } = getConf(assembly, [
          'sequence',
          'metadata',
        ]) as { internetAccountConfigId?: string; file: string }
        if (isElectron && file) {
          return self.desktopFileDriver
        }
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
          if (!backendDriver) {
            return
          }
          const [features, checkResults] = (yield backendDriver.getFeatures(
            region,
          )) as [AnnotationFeatureSnapshot[], CheckResultSnapshot[]]
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
          self.addCheckResults(checkResults)
        }
      }),
      loadRefSeq: flow(function* loadRefSeq(regions: Region[]) {
        for (const region of regions) {
          const backendDriver = self.getBackendDriver(region.assemblyName)
          if (!backendDriver) {
            return
          }
          const { refSeq, seq } = yield backendDriver.getSequence(region)
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
}
