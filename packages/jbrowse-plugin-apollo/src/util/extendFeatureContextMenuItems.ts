import type { FeatureContextMenuItemsProps } from '@apollo-annotation/common/client'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { MenuItem } from '@jbrowse/core/ui'
import type { AbstractSessionModel } from '@jbrowse/core/util'

/**
 * Let plugins change the context menu items for a feature, through the
 * `Apollo-FeatureContextMenuItems` extension point
 */
export function extendFeatureContextMenuItems(
  pluginManager: PluginManager,
  menuItems: MenuItem[],
  props: Omit<FeatureContextMenuItemsProps, 'session'> & { session: object },
): MenuItem[] {
  const extensionPointProps: FeatureContextMenuItemsProps = {
    ...props,
    session: props.session as AbstractSessionModel,
  }
  return pluginManager.evaluateExtensionPoint(
    'Apollo-FeatureContextMenuItems',
    menuItems,
    { ...extensionPointProps },
  )
}
