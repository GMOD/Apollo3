import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Instance } from '@jbrowse/mobx-state-tree'

import { renderingModelFactory } from './rendering'

export function stateModelFactory(
  pluginManager: PluginManager,
  configSchema: AnyConfigurationSchemaType,
) {
  // TODO: this needs to be refactored so that the final composition of the
  // state model mixins happens here in one central place
  return renderingModelFactory(pluginManager, configSchema).named(
    'LinearApolloReferenceSequenceDisplay',
  )
}

export type LinearApolloReferenceSequenceDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
// eslint disable because of
// https://mobx-state-tree.js.org/tips/typescript#using-a-mst-type-at-design-time
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface LinearApolloReferenceSequenceDisplay
  extends Instance<LinearApolloReferenceSequenceDisplayStateModel> {}
