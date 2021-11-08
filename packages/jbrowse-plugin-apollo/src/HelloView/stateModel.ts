import { types } from 'mobx-state-tree'

const stateModel = types
  .model({ type: types.literal('HelloView') })
  .actions(() => ({
    // unused but required by your view
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    setWidth() {},
  }))

export default stateModel
