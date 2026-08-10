import type { Connection } from 'mongoose'

/**
 * What a user is granted: either every assembly (`'*'`) or a list of assembly
 * names. Names are matched against an assembly's `name`, `displayName` or
 * `aliases`, and an assembly's id may also be used.
 */
export type AssemblyGrant = '*' | string[]

/** Passed to the `Apollo-AssemblyAccess` extension point callback */
export interface AssemblyAccessProps {
  /** The Mongoose connection to the Apollo database */
  connection: Connection
}

/**
 * The value the `Apollo-AssemblyAccess` extension point evaluates to, keyed by
 * user email address. Users the structure does not mention have access to no
 * assemblies at all.
 *
 * Returning `undefined` from the extension point (or not registering it) leaves
 * every user with access to every assembly.
 *
 * @example
 * ```ts
 * pluginManager.addToExtensionPoint(
 *   'Apollo-AssemblyAccess',
 *   (_extendee, { connection }: AssemblyAccessProps) =>
 *     new Map([
 *       ['alice@example.com', ['GRCh38']],
 *       ['bob@example.com', '*'],
 *     ]),
 * )
 * ```
 */
export type AssemblyAccess =
  | Map<string, AssemblyGrant>
  | Record<string, AssemblyGrant>
