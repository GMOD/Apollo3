import type { DetailsWidgetCustomComponentProps } from '@apollo-annotation/common/client'
import type PluginManager from '@jbrowse/core/PluginManager'
import type React from 'react'

function NoOpCustomComponent(_props: DetailsWidgetCustomComponentProps) {
  return null
}

/**
 * Get the component plugins added to a details widget slot through its
 * extension point, or one that renders nothing
 */
export function getCustomComponent(
  pluginManager: PluginManager,
  extensionPointName: string,
  props: DetailsWidgetCustomComponentProps,
) {
  return pluginManager.evaluateExtensionPoint(
    extensionPointName,
    NoOpCustomComponent,
    { ...props },
  ) as React.ElementType<DetailsWidgetCustomComponentProps>
}
