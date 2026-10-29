import type { Request, Response } from 'express'
import type { Connection } from 'mongoose'

import type { Logger } from '../Change.js'

import type { ServerValidationUser } from './ServerValidation.js'

/** Passed to the `Apollo-RegisterRoutes` extension point callback */
export interface PluginRouteProps {
  /** The Mongoose connection to the Apollo database */
  connection: Connection
}

/** The minimum role a user needs to use a {@link PluginRoute} */
export type PluginRouteRole = 'admin' | 'user' | 'readOnly' | 'none'

/** Passed to a {@link PluginRoute} handler along with the request and response */
export interface PluginRouteContext {
  /** Values of the parameters in the route's `path`, e.g. `id` for `/:id` */
  params: Partial<Record<string, string | string[]>>
  /** The user making the request, or undefined if they aren't logged in */
  user?: ServerValidationUser
  /**
   * IDs of the assemblies the user may access, or undefined if they are
   * unrestricted. Routes that return assembly data should respect this; see
   * the `Apollo-AssemblyAccess` hook.
   */
  allowedAssemblyIds: string[] | undefined
  /** The Mongoose connection to the Apollo database */
  connection: Connection
  logger: Logger
}

/**
 * A single HTTP route contributed to the `Apollo-RegisterRoutes` hook.
 * Requests to `/plugin-routes${path}` on the collaboration server are
 * dispatched to `handler`, already past the server's normal authentication
 * guards.
 *
 * Prefix `path` with something unique to your plugin (its `name` is a
 * reasonable choice) to avoid colliding with routes registered by other
 * plugins, e.g. `/my-plugin-name/widgets`.
 *
 * @example
 * ```ts
 * registrar.registerHook('Apollo-RegisterRoutes', (routes, { connection }) => [
 *   ...routes,
 *   {
 *     method: 'GET',
 *     path: '/my-plugin-name/widgets/:id',
 *     handler: async (_req, res, { params }) => {
 *       const widget = await connection
 *         .collection('myPluginWidgets')
 *         .findOne({ id: params.id })
 *       res.json(widget)
 *     },
 *   },
 * ])
 * ```
 */
export interface PluginRoute {
  /** An HTTP method, e.g. `'GET'` or `'POST'` */
  method: string
  /**
   * A path starting with `/`, matched against the request path after the
   * `/plugin-routes` prefix. May contain parameters (`/:id`) and wildcards
   * (`/*rest`), as in Express 5 routes.
   */
  path: string
  /**
   * The minimum role needed to use this route. Defaults to `'readOnly'`;
   * `'none'` makes the route available to users who aren't logged in.
   */
  role?: PluginRouteRole
  /** Handles matching requests */
  handler(
    req: Request,
    res: Response,
    context: PluginRouteContext,
  ): void | Promise<void>
}
