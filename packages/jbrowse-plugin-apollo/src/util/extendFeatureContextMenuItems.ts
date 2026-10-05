import type { FeatureContextMenuItemsProps } from '@apollo-annotation/common/client'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { MenuItem } from '@jbrowse/core/ui'
import type { AbstractSessionModel } from '@jbrowse/core/util'

import type { ApolloSessionModel } from '../session'

/**
 * Let plugins add context menu items for a feature, through the
 * `Apollo-FeatureContextMenuItems` extension point
 */
export function extendFeatureContextMenuItems(
  pluginManager: PluginManager,
  menuItems: MenuItem[],
  props: Omit<FeatureContextMenuItemsProps, 'session' | 'submitChange'> & {
    session: object
  },
): MenuItem[] {
  const session = props.session as ApolloSessionModel
  return pluginManager.evaluateExtensionPoint(
    'Apollo-FeatureContextMenuItems',
    menuItems,
    {
      ...props,
      session: props.session as AbstractSessionModel,
      submitChange: (change) =>
        session.apolloDataStore.changeManager.submit(change),
    },
  )
}
