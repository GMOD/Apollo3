import { types, Instance } from 'mobx-state-tree'

const stateModel = types
  .model({
    // type: types.literal(''),
    assemblyName: types.optional(types.string, ''),
    assemblyDesc: types.optional(types.string, ''),
    // file: typeof Blob,
  })
  .actions(self => ({
    setAssemblyName(message: string) {
      self.assemblyName = message
    },
    setAssemblyDesc(message: string) {
      self.assemblyDesc = message
    },
    // setFile(file: Blob) {
    //   self.file = file
    // }, 
   }))

export default stateModel
export type ViewModel = Instance<typeof stateModel>
