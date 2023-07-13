import { AnyConfigurationSchemaType } from '@jbrowse/core/configuration/configurationSchema'
import PluginManager from '@jbrowse/core/PluginManager'
import { Instance, types } from 'mobx-state-tree'

import { TabularEditorStateModelType } from '../../TabularEditor'
import { mouseEventsModelFactory } from './mouseEvents'

export function stateModelFactory(
  pluginManager: PluginManager,
  configSchema: AnyConfigurationSchemaType,
) {
  // TODO: this needs to be refactored so that the final composition of the
  // state model mixins happens here in one central place
  return mouseEventsModelFactory(pluginManager, configSchema)
    .props({ tabularEditor: types.optional(TabularEditorStateModelType, {}) })
    .named('LinearApolloDisplay')
}

export type LinearApolloDisplayStateModel = ReturnType<typeof stateModelFactory>
export type LinearApolloDisplay = Instance<LinearApolloDisplayStateModel>
