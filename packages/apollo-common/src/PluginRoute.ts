import type { Request, Response } from 'express'
import type { Connection } from 'mongoose'

/** Passed to the `Apollo-RegisterRoutes` extension point callback */
export interface PluginRouteProps {
  /** The Mongoose connection to the Apollo database */
  connection: Connection
}

/**
 * A single HTTP route contributed to the `Apollo-RegisterRoutes` extension
 * point. Requests to `/plugin-routes${path}` on the collaboration server are
 * dispatched to `handler`, already past the server's normal authentication and
 * validation guards.
 *
 * Prefix `path` with something unique to your plugin (its `name` is a
 * reasonable choice) to avoid colliding with routes registered by other
 * plugins, e.g. `/my-plugin-name/widgets`.
 *
 * @example
 * ```ts
 * pluginManager.addToExtensionPoint(
 *   'Apollo-RegisterRoutes',
 *   (routes: PluginRoute[], { connection }: PluginRouteProps) => {
 *     routes.push({
 *       method: 'GET',
 *       path: '/my-plugin-name/widgets',
 *       handler: async (_req, res) => {
 *         const widgets = await connection.collection('myPluginWidgets').find().toArray()
 *         res.json(widgets)
 *       },
 *     })
 *     return routes
 *   },
 * )
 * ```
 */
export interface PluginRoute {
  /** An HTTP method, e.g. `'GET'` or `'POST'` */
  method: string
  /** A path starting with `/`, matched against the request path after the `/plugin-routes` prefix */
  path: string
  /** Handles matching requests. Runs with the same request/response objects a NestJS controller would receive. */
  handler: (req: Request, res: Response) => void | Promise<void>
}
