import { types, Instance } from 'mobx-state-tree'

const stateModel = types
  .model({
    assemblyName: types.optional(types.string, ''),
    assemblyDesc: types.optional(types.string, ''),
    fileType: types.optional(types.string, ''),
  })
  .actions(self => ({
    setAssemblyName(message: string) {
      self.assemblyName = message
    },
    setAssemblyDesc(message: string) {
      self.assemblyDesc = message
    },
    setFileType(message: string) {
      self.fileType = message
    },
   }))

export default stateModel
export type ViewModel = Instance<typeof stateModel>
