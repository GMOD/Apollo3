import type PluginManager from '@jbrowse/core/PluginManager'
import { type AnyConfigurationSchemaType } from '@jbrowse/core/configuration/configurationSchema'
import { type Instance, types } from 'mobx-state-tree'

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
    .named('LinearApolloSixFrameDisplay')
}

export type LinearApolloSixFrameDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
// eslint disable because of
// https://mobx-state-tree.js.org/tips/typescript#using-a-mst-type-at-design-time
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface LinearApolloSixFrameDisplay
  extends Instance<LinearApolloSixFrameDisplayStateModel> {}
