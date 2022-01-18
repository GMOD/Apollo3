import { ConfigurationSchema } from '@jbrowse/core/configuration'
import PluginManager from '@jbrowse/core/PluginManager'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { types } from 'mobx-state-tree'
import ReactComponent from './components/ApolloAuthWidget'

// export const configSchema = ConfigurationSchema('ApolloAuthWidget', {})

// export const stateModel = types.model('ApolloAuthWidget', {
//   id: ElementId,
//   type: types.literal('ApolloAuthWidget'),
// })

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default (_: PluginManager) => {
  const configSchema = ConfigurationSchema('ApolloAuthWidget', {})
  const stateModel = types
    .model('ApolloAuthWidget', {
      id: ElementId,
      type: types.literal('ApolloAuthWidget'),
      featureData: types.frozen({}),
    })
    .actions(self => ({
      setFeatureData(data: any) {
        self.featureData = data
      },
      clearFeatureData() {
        self.featureData = {}
      },
    }))

  return { configSchema, stateModel, ReactComponent }
}
