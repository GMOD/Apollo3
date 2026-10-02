import type { Connection } from 'mongoose'

import type { AssemblyAccess, AssemblyAccessProps } from './AssemblyAccess.js'
import type { ChangeConstructor } from './ChangeTypeRegistry.js'
import type { Check } from './Check.js'
import type { CustomAuthHandler } from './CustomAuthHandler.js'
import type { PluginRoute, PluginRouteProps } from './PluginRoute.js'
import type { Validation } from './Validation.js'

/**
 * Every hook a server plugin may register with, and the exact signature its
 * callback must have. Passed as the type parameter of
 * {@link ApolloServerHookRegistrar.registerHook}, so a plugin author gets
 * autocomplete on the hook name and a compile error if their callback's
 * signature doesn't match.
 */
export interface ApolloServerHookMap {
  /** Hands the plugin the Mongoose connection once, at server startup. */
  'Apollo-MongoDB': (
    extendee: undefined,
    props: { connection: Connection },
  ) => void
  /** Collects HTTP routes the plugin wants served under `/plugin-routes`. */
  'Apollo-RegisterRoutes': (
    extendee: PluginRoute[],
    props: PluginRouteProps,
  ) => PluginRoute[] | Promise<PluginRoute[]>
  /** Restricts which assemblies a user may access. Evaluated on every request. */
  'Apollo-AssemblyAccess': (
    extendee: undefined,
    props: AssemblyAccessProps,
  ) => AssemblyAccess | undefined | Promise<AssemblyAccess | undefined>
  /** Collects custom login methods. */
  'Apollo-RegisterCustomAuth': (
    extendee: Map<string, CustomAuthHandler>,
    props: Record<string, never>,
  ) => Map<string, CustomAuthHandler> | Promise<Map<string, CustomAuthHandler>>
  /** Collects custom CRDT Change types, registered into the shared `changeRegistry`. */
  'Apollo-RegisterChangeTypes': (
    extendee: Record<string, ChangeConstructor>,
    props: Record<string, never>,
  ) =>
    | Record<string, ChangeConstructor>
    | Promise<Record<string, ChangeConstructor>>
  /** Collects custom feature Checks, registered into the shared `checkRegistry`. */
  'Apollo-RegisterChecks': (
    extendee: Check[],
    props: Record<string, never>,
  ) => Check[] | Promise<Check[]>
  /** Collects custom change Validations, registered into the shared `validationRegistry`. */
  'Apollo-RegisterValidations': (
    extendee: Validation[],
    props: Record<string, never>,
  ) => Validation[] | Promise<Validation[]>
}

export type ApolloServerHookName = keyof ApolloServerHookMap

export interface ApolloServerHookRegistrar {
  /**
   * Register a callback for a named hook. Callbacks receive the current
   * accumulated value (`extendee`) and a hook-specific `props` bag, and
   * return the new accumulated value. If more than one plugin registers the
   * same hook, push onto/extend the value you're given rather than replacing
   * it, so every plugin's contribution survives.
   */
  registerHook<Name extends ApolloServerHookName>(
    name: Name,
    callback: ApolloServerHookMap[Name],
  ): void
}

/**
 * How a failing hook callback is handled:
 * - `startup-fatal`: evaluated once at boot; a thrown error aborts server
 *   startup, since these run before any traffic is served.
 * - `request-fail-closed`: evaluated per request; a thrown error is logged
 *   and denies access. Never falls back to "no plugin registered", which
 *   would fail open instead of closed.
 */
export type ApolloServerHookSeverity = 'request-fail-closed' | 'startup-fatal'

export const APOLLO_SERVER_HOOK_SEVERITY: Record<
  ApolloServerHookName,
  ApolloServerHookSeverity
> = {
  'Apollo-MongoDB': 'startup-fatal',
  'Apollo-RegisterRoutes': 'startup-fatal',
  'Apollo-AssemblyAccess': 'request-fail-closed',
  'Apollo-RegisterCustomAuth': 'startup-fatal',
  'Apollo-RegisterChangeTypes': 'startup-fatal',
  'Apollo-RegisterChecks': 'startup-fatal',
  'Apollo-RegisterValidations': 'startup-fatal',
}
