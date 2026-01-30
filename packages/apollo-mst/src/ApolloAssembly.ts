import { type Instance, type SnapshotIn, types } from '@jbrowse/mobx-state-tree'

import { ApolloRefSeq } from './ApolloRefSeq.js'

export type BackendDriverType =
  | 'CollaborationServerDriver'
  | 'InMemoryFileDriver'
  | 'DesktopFileDriver'

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
    addRefSeq(id: string, name: string, description?: string) {
      return self.refSeqs.put({ _id: id, name, description })
    },
    addComment(comment: string) {
      return self.comments.push(comment)
    },
  }))

// eslint disables because of
// https://mobx-state-tree.js.org/tips/typescript#using-a-mst-type-at-design-time
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ApolloAssemblyI extends Instance<typeof ApolloAssembly> {}
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ApolloAssemblySnapshot
  extends SnapshotIn<typeof ApolloAssembly> {}
