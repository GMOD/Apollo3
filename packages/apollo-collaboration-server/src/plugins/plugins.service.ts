import { ApolloPlugin } from '@apollo-annotation/apollo-common'
import { Inject, Injectable } from '@nestjs/common'

import { APOLLO_PLUGINS } from './plugins.constants'

@Injectable()
export class PluginsService {
  // eslint-disable-next-line @typescript-eslint/ban-types
  extensionPoints = new Map<string, Function[]>()

  constructor(@Inject(APOLLO_PLUGINS) private plugins: ApolloPlugin[]) {
    for (const plugin of plugins) {
      plugin.apolloInstall({
        addToExtensionPoint: this.addToExtensionPoint.bind(this),
      })
    }
  }

  addToExtensionPoint<T>(
    extensionPointName: string,
    callback: (extendee: T, props: Record<string, unknown>) => T,
  ) {
    let callbacks = this.extensionPoints.get(extensionPointName)
    if (!callbacks) {
      callbacks = []
      this.extensionPoints.set(extensionPointName, callbacks)
    }
    callbacks.push(callback)
  }

  evaluateExtensionPoint(
    extensionPointName: string,
    extendee: unknown,
    props?: Record<string, unknown>,
  ) {
    const callbacks = this.extensionPoints.get(extensionPointName)
    let accumulator = extendee
    if (callbacks) {
      for (const callback of callbacks) {
        try {
          accumulator = callback(accumulator, props)
        } catch (error) {
          console.error(error)
        }
      }
    }
    return accumulator
  }
}
