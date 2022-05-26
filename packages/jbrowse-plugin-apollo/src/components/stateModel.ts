import { types, Instance } from 'mobx-state-tree'

const stateModel = types
  .model({
    type: types.literal('HelloView'),
    assemblyName: types.optional(types.string, ''),
    assemblyDesc: types.optional(types.string, ''),
  })
  .actions(self => ({
    // unused but required by your view
    setAssemblyName(message: string) {
      self.assemblyName = message
    },
    setAssemblyDesc(message: string) {
      self.assemblyDesc = message
    },
  }))

export default stateModel
export type ViewModel = Instance<typeof stateModel>
