/* eslint-disable @typescript-eslint/no-unsafe-call */
import { ApolloPlugin, type PluginRoute } from '@apollo-annotation/common'
import { Inject, Injectable } from '@nestjs/common'
import { InjectConnection } from '@nestjs/mongoose'
import type { Connection } from 'mongoose'

import { APOLLO_PLUGINS } from './plugins.constants.js'

@Injectable()
export class PluginsService {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  extensionPoints = new Map<string, Function[]>()

  pluginRoutes: PluginRoute[] = []

  constructor(
    @Inject(APOLLO_PLUGINS) private plugins: ApolloPlugin[],
    @InjectConnection() private connection: Connection,
  ) {
    for (const plugin of plugins) {
      plugin.apolloInstall({
        addToExtensionPoint: this.addToExtensionPoint.bind(this),
      })
    }
    this.evaluateExtensionPoint('Apollo-MongoDB', undefined, {
      connection: this.connection,
    })
    this.pluginRoutes = this.evaluateExtensionPoint<PluginRoute[]>(
      'Apollo-RegisterRoutes',
      [],
      { connection: this.connection },
    )
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

  evaluateExtensionPoint<T>(
    extensionPointName: string,
    extendee: T,
    props?: Record<string, unknown>,
  ) {
    const callbacks = this.extensionPoints.get(extensionPointName)
    let accumulator = extendee
    if (!callbacks) {
      return accumulator
    }
    for (const callback of callbacks) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        accumulator = callback(accumulator, props)
      } catch (error) {
        console.error(error)
      }
    }
    return accumulator
  }
}
