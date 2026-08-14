import {
  APOLLO_SERVER_HOOK_SEVERITY,
  type ApolloServerHookName,
  type ApolloServerHookRegistrar,
  type ApolloServerPlugin,
  type ChangeConstructor,
  type Check,
  changeRegistry,
  checkRegistry,
  type CustomAuthHandler,
  type PluginRoute,
  type Validation,
} from '@apollo-annotation/common'
import { validationRegistry } from '@apollo-annotation/shared'
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import { InjectConnection } from '@nestjs/mongoose'
import type { Connection } from 'mongoose'

import { APOLLO_PLUGINS } from './plugins.constants.js'

interface RegisteredHook {
  pluginName: string
  callback: (extendee: unknown, props: unknown) => unknown
}

@Injectable()
export class PluginsService implements OnModuleInit {
  private readonly logger = new Logger(PluginsService.name)

  private readonly hooks = new Map<ApolloServerHookName, RegisteredHook[]>()

  pluginRoutes: PluginRoute[] = []

  private customAuthHandlers = new Map<string, CustomAuthHandler>()

  constructor(
    @Inject(APOLLO_PLUGINS) private readonly plugins: ApolloServerPlugin[],
    @InjectConnection() private readonly connection: Connection,
  ) {}

  async onModuleInit() {
    for (const plugin of this.plugins) {
      const registrar: ApolloServerHookRegistrar = {
        registerHook: (name, callback) => {
          this.registerHook(
            plugin.name,
            name,
            callback as (extendee: unknown, props: unknown) => unknown,
          )
        },
      }
      await plugin.install(registrar)
    }

    await this.evaluateStartupHook('Apollo-MongoDB', undefined, {
      connection: this.connection,
    })

    this.pluginRoutes = await this.evaluateStartupHook<PluginRoute[]>(
      'Apollo-RegisterRoutes',
      [],
      { connection: this.connection },
    )

    this.customAuthHandlers = await this.evaluateStartupHook<
      Map<string, CustomAuthHandler>
    >('Apollo-RegisterCustomAuth', new Map(), {})

    const changeTypes = await this.evaluateStartupHook<
      Record<string, ChangeConstructor>
    >('Apollo-RegisterChangeTypes', {}, {})
    for (const [name, changeType] of Object.entries(changeTypes)) {
      changeRegistry.registerChange(name, changeType)
    }

    const checks = await this.evaluateStartupHook<Check[]>(
      'Apollo-RegisterChecks',
      [],
      {},
    )
    for (const check of checks) {
      checkRegistry.registerCheck(check.name, check)
    }

    const validations = await this.evaluateStartupHook<Validation[]>(
      'Apollo-RegisterValidations',
      [],
      {},
    )
    for (const validation of validations) {
      validationRegistry.registerValidation(validation)
    }
  }

  /** Custom login methods plugins registered, collected once at startup. */
  getCustomAuthHandlers() {
    return this.customAuthHandlers
  }

  hasHook(name: ApolloServerHookName) {
    return (this.hooks.get(name)?.length ?? 0) > 0
  }

  private registerHook(
    pluginName: string,
    name: ApolloServerHookName,
    callback: (extendee: unknown, props: unknown) => unknown,
  ) {
    let registered = this.hooks.get(name)
    if (!registered) {
      registered = []
      this.hooks.set(name, registered)
    }
    registered.push({ pluginName, callback })
  }

  /**
   * Evaluated once at boot. A callback that throws is logged with the
   * offending plugin's name and rethrown, aborting server startup — these
   * hooks run before any traffic is served, so failing loudly here costs
   * nothing and prevents a silently-broken deployment from going live.
   */
  private async evaluateStartupHook<T>(
    name: ApolloServerHookName,
    extendee: T,
    props: Record<string, unknown>,
  ): Promise<T> {
    if (APOLLO_SERVER_HOOK_SEVERITY[name] !== 'startup-fatal') {
      throw new Error(`Internal error: "${name}" is not a startup-fatal hook`)
    }
    let accumulator: unknown = extendee
    for (const { callback, pluginName } of this.hooks.get(name) ?? []) {
      try {
        accumulator = await callback(accumulator, props)
      } catch (error) {
        this.logger.error(
          `Plugin "${pluginName}" threw while handling "${name}" during startup: ${String(error)}`,
        )
        throw error
      }
    }
    return accumulator as T
  }

  /**
   * Evaluated per request. A callback that throws is logged with the
   * offending plugin's name and rethrown rather than swallowed — swallowing
   * it would make a throwing plugin indistinguishable from no plugin being
   * registered at all, which for a security-relevant hook means failing open
   * instead of closed. Callers must catch this and deny.
   */
  async evaluateSecurityHook<T>(
    name: ApolloServerHookName,
    extendee: T,
    props: Record<string, unknown>,
  ): Promise<T> {
    if (APOLLO_SERVER_HOOK_SEVERITY[name] !== 'request-fail-closed') {
      throw new Error(
        `Internal error: "${name}" is not a request-fail-closed hook`,
      )
    }
    let accumulator: unknown = extendee
    for (const { callback, pluginName } of this.hooks.get(name) ?? []) {
      try {
        accumulator = await callback(accumulator, props)
      } catch (error) {
        this.logger.error(
          `Plugin "${pluginName}" threw while handling "${name}"; denying by default: ${String(error)}`,
        )
        throw error
      }
    }
    return accumulator as T
  }
}
