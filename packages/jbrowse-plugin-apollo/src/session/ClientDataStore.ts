import { getConf } from '@jbrowse/core/configuration'
import { AppRootModel, Region, getSession } from '@jbrowse/core/util'
import { ClientDataStore as ClientDataStoreType } from 'apollo-common'
import {
  AnnotationFeature,
  AnnotationFeatureSnapshot,
  ApolloAssembly,
  ApolloRefSeq,
} from 'apollo-mst'
import {
  flow,
  getParentOfType,
  getRoot,
  resolveIdentifier,
  types,
} from 'mobx-state-tree'

import {
  BackendDriver,
  CollaborationServerDriver,
  InMemoryFileDriver,
} from '../BackendDrivers'
import { ChangeManager } from '../ChangeManager'
import { ApolloRootModel } from '../types'

export function clientDataStoreFactory(
  AnnotationFeatureExtended: typeof AnnotationFeature,
) {
  return types
    .model('ClientDataStore', {
      typeName: types.optional(types.literal('Client'), 'Client'),
      assemblies: types.map(ApolloAssembly),
    })
    .views((self) => ({
      get internetAccounts() {
        return (getRoot<ApolloRootModel>(self) as AppRootModel).internetAccounts
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
        const { parent } = feature
        if (parent) {
          parent.deleteChild(featureId)
        } else {
          const refSeq = getParentOfType(feature, ApolloRefSeq)
          refSeq.deleteFeature(feature._id)
        }
      },
      deleteAssembly(assemblyId: string) {
        self.assemblies.delete(assemblyId)
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
    }))
    .actions((self) => ({
      loadFeatures: flow(function* loadFeatures(regions: Region[]) {
        for (const region of regions) {
          const backendDriver = self.getBackendDriver(region.assemblyName)
          const features = (yield backendDriver.getFeatures(
            region,
          )) as AnnotationFeatureSnapshot[]
          if (!features.length) {
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
          const { seq, refSeq } = yield (
            self as unknown as { backendDriver: BackendDriver }
          ).backendDriver.getSequence(region)
          const { assemblyName, refName } = region
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
          ref.addSequence({
            start: region.start,
            stop: region.end,
            sequence: seq,
          })
        }
      }),
    }))
}
