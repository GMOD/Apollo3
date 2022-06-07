import { types, Instance } from 'mobx-state-tree'

const stateModel = types
  .model({
    // type: types.literal(''),
    assemblyName: types.optional(types.string, ''),
    assemblyDesc: types.optional(types.string, ''),
    // collection: types.optional(types.array,[]),
    // file: typeof Blob,
  })
  .actions(self => ({
    setAssemblyName(message: string) {
      self.assemblyName = message
    },
    setAssemblyDesc(message: string) {
      self.assemblyDesc = message
    },
    // setCollection(items: Array) {
    //   self.collection = items
    // }, 
   }))

export default stateModel
export type ViewModel = Instance<typeof stateModel>
