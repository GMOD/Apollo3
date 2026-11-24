import type PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { WidgetType } from '@jbrowse/core/pluggableElementTypes'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { types } from '@jbrowse/mobx-state-tree'

import { ApolloHelpWidget } from './ApolloHelpWidget'

const configSchema = ConfigurationSchema('ApolloHelpWidget', {})

const stateModel = types.model('ApolloHelpWidget', {
  id: ElementId,
  type: types.literal('ApolloHelpWidget'),
})

export function installApolloHelpWidget(pluginManager: PluginManager) {
  pluginManager.addWidgetType(
    () =>
      new WidgetType({
        name: 'ApolloHelpWidget',
        heading: 'Apollo help',
        configSchema,
        stateModel,
        ReactComponent: ApolloHelpWidget,
      }),
  )
}
