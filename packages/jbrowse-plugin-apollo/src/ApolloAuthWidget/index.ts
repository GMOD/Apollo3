import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { types } from 'mobx-state-tree'

export { default as ReactComponent } from './components/ApolloAuthWidget'

export const configSchema = ConfigurationSchema('ApolloAuthWidget', {})
export const stateModel = types
  .model('ApolloAuthWidget', {
    id: ElementId,
    type: types.literal('ApolloAuthWidget'),
    featureData: types.frozen({}),
  })
  .actions((self) => ({
    setFeatureData(data: any) {
      self.featureData = data
    },
    clearFeatureData() {
      self.featureData = {}
    },
  }))
