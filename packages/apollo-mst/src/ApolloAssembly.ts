import { Instance, SnapshotIn, types } from 'mobx-state-tree'

import { ApolloRefSeq } from './ApolloRefSeq'

export const ApolloAssembly = types
  .model('ApolloAssembly', {
    _id: types.identifier,
    refSeqs: types.map(ApolloRefSeq),
    comments: types.array(types.string),
    backendDriverType: types.optional(
      types.enumeration('backendDriverType', [
        'CollaborationServerDriver',
        'InMemoryFileDriver',
        'DesktopFileDriver',
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
    addComment(comment: string) {
      return self.comments.push(comment)
    },
  }))

export type ApolloAssemblyI = Instance<typeof ApolloAssembly>
export type ApolloAssemblySnapshot = SnapshotIn<typeof ApolloAssembly>
