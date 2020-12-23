import { ConfigurationSchema } from '@jbrowse/core/configuration'
import PluginManager from '@jbrowse/core/PluginManager'
import { ElementId } from '@jbrowse/core/util/types/mst'
import ApolloWidgetF from './components/ApolloWidget'

export default (jbrowse: PluginManager) => {
  const { types } = jbrowse.jbrequire('mobx-state-tree')
  const configSchema = ConfigurationSchema('ApolloWidget', {})
  const stateModel = types.model('ApolloWidget', {
    id: ElementId,
    type: types.literal('ApolloWidget'),
    featureData: types.frozen({}),
  })

  const ReactComponent = jbrowse.jbrequire(ApolloWidgetF)

  return { configSchema, stateModel, ReactComponent }
}
