import { Inject, Injectable } from '@nestjs/common'
import { ApolloPlugin } from 'apollo-common'

import { APOLLO_PLUGINS } from './plugins.constants'

@Injectable()
export class PluginsService {
  // eslint-disable-next-line @typescript-eslint/ban-types
  extensionPoints: Map<string, Function[]> = new Map()

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
