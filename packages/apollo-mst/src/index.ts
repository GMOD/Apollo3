import { Instance, SnapshotIn, types } from 'mobx-state-tree'

import { AnnotationFeature } from './AnnotationFeature'

// const Region = types.model('ApolloRegion', {
//   start: types.number,
//   end: types.number,
// })

export const ApolloRefSeq = types
  .model('ApolloRefSeq', {
    _id: types.identifier,
    name: types.string,
    features: types.map(AnnotationFeature),
  })
  .actions((self) => ({
    deleteFeature(featureId: string) {
      return self.features.delete(featureId)
    },
  }))

export const ApolloAssembly = types
  .model('ApolloAssembly', {
    _id: types.identifier,
    refSeqs: types.map(ApolloRefSeq),
  })
  .views((self) => ({
    getByRefName(refName: string) {
      return Array.from(self.refSeqs.values()).find(
        (val) => val.name === refName,
      )
    },
  }))

export type ApolloRefSeqI = Instance<typeof ApolloRefSeq>
export type ApolloRefSeqSnapshot = SnapshotIn<typeof ApolloRefSeq>
export type ApolloAssemblyI = Instance<typeof ApolloAssembly>
export type ApolloAssemblySnapshot = SnapshotIn<typeof ApolloAssembly>

export * from './AnnotationFeature'
