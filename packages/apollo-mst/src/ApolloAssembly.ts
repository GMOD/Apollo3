import { Instance, SnapshotIn, types } from 'mobx-state-tree'

import { ApolloRefSeq } from './ApolloRefSeq'

export const ApolloAssembly = types
  .model('ApolloAssembly', {
    _id: types.identifier,
    refSeqs: types.map(ApolloRefSeq),
    backendDriverType: types.optional(
      types.enumeration('backendDriverType', [
        'CollaborationServerDriver',
        'InMemoryFileDriver',
      ]),
      'CollaborationServerDriver',
    ),
  })
  .views((self) => ({
    getByRefName(refName: string) {
      return [...self.refSeqs.values()].find((val) => val.name === refName)
    },
  }))
  .actions((self) => ({
    addRefSeq(id: string, name: string) {
      return self.refSeqs.put({ _id: id, name })
    },
  }))

export type ApolloAssemblyI = Instance<typeof ApolloAssembly>
export type ApolloAssemblySnapshot = SnapshotIn<typeof ApolloAssembly>
