import type { DetailsWidgetCustomComponentProps } from '@apollo-annotation/common/client'
import type PluginManager from '@jbrowse/core/PluginManager'
import type React from 'react'

import type { ApolloSessionModel } from '../session'

function NoOpCustomComponent(_props: DetailsWidgetCustomComponentProps) {
  return null
}

/** The props Apollo passes to details widget custom components */
export function getCustomComponentProps(
  props: Omit<DetailsWidgetCustomComponentProps, 'submitChange'>,
): DetailsWidgetCustomComponentProps {
  const session = props.session as unknown as ApolloSessionModel
  return {
    ...props,
    submitChange: (change) =>
      session.apolloDataStore.changeManager.submit(change),
  }
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
