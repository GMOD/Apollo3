import {
  type ApolloServerHookRegistrar,
  ApolloServerPlugin,
  type PluginRoute,
  type ServerChangeContext,
} from '@apollo-annotation/common/server'
import type { Connection } from 'mongoose'

import { ExampleNoteLengthRule } from '../shared/ExampleNoteLengthRule.js'
import { ExampleNotesChange } from '../shared/ExampleNotesChange.js'
import { ExampleShortFeatureCheck } from '../shared/ExampleShortFeatureCheck.js'

/** The parts of a stored feature document this plugin uses */
interface StoredFeature {
  _id: { toString(): string }
  refSeq: { toString(): string }
  attributes?: Map<string, string[]> | Record<string, string[]>
  children?: Map<string, StoredFeature>
}

interface StoredFeatureDocument extends StoredFeature {
  markModified(path: string): void
  save(): Promise<unknown>
}

function findFeature(
  feature: StoredFeature,
  featureId: string,
): StoredFeature | undefined {
  if (feature._id.toString() === featureId) {
    return feature
  }
  for (const child of feature.children?.values() ?? []) {
    const found = findFeature(child, featureId)
    if (found) {
      return found
    }
  }
  return
}

function getNotes(feature: StoredFeature): string[] {
  const { attributes } = feature
  const notes =
    attributes instanceof Map ? attributes.get('note') : attributes?.note
  return notes ?? []
}

function getFeatureModel(connection: Connection) {
  return connection.model<StoredFeatureDocument>('Feature')
}

/** Applies an ExampleNotesChange to the database, inside its transaction */
export async function applyNotesChange(
  change: ExampleNotesChange,
  { connection, session }: ServerChangeContext,
) {
  const { featureId, newNotes } = change
  const topLevelFeature = await getFeatureModel(connection)
    .findOne({ allIds: featureId })
    .session(session)
    .exec()
  const feature = topLevelFeature && findFeature(topLevelFeature, featureId)
  if (!topLevelFeature || !feature) {
    throw new Error(`Could not find feature "${featureId}"`)
  }
  const attributes = Object.fromEntries(
    feature.attributes instanceof Map
      ? feature.attributes
      : Object.entries(feature.attributes ?? {}),
  )
  if (newNotes.length > 0) {
    attributes.note = newNotes
  } else {
    delete attributes.note
  }
  feature.attributes = attributes
  topLevelFeature.markModified(
    feature === topLevelFeature ? 'attributes' : 'children',
  )
  await topLevelFeature.save()
}

/** GET /plugin-routes/apollo-plugin-example/features/:featureId/notes */
export const notesRoute: PluginRoute = {
  method: 'GET',
  path: '/apollo-plugin-example/features/:featureId/notes',
  async handler(_req, res, { allowedAssemblyIds, connection, params }) {
    const featureId = String(params.featureId)
    const topLevelFeature = await getFeatureModel(connection)
      .findOne({ allIds: featureId })
      .exec()
    const feature = topLevelFeature && findFeature(topLevelFeature, featureId)
    if (!feature) {
      res.status(404).end()
      return
    }
    // Respect assembly access restrictions (see the Apollo-AssemblyAccess hook)
    if (allowedAssemblyIds) {
      const refSeq = await connection
        .model<{ assembly: { toString(): string } }>('RefSeq')
        .findById(feature.refSeq.toString())
        .exec()
      if (!refSeq || !allowedAssemblyIds.includes(refSeq.assembly.toString())) {
        res.status(404).end()
        return
      }
    }
    res.json({ featureId, notes: getNotes(feature) })
  },
}

/**
 * The server half of the example plugin. Build it with `yarn build:server` and
 * load `dist/server.bundle.js` with `PLUGIN_URLS`.
 */
export default class ApolloExampleServerPlugin extends ApolloServerPlugin {
  name = 'ApolloExamplePlugin'

  install(registrar: ApolloServerHookRegistrar) {
    registrar.registerHook('Apollo-RegisterChangeTypes', (changeTypes) => ({
      ...changeTypes,
      ExampleNotesChange: {
        changeType: ExampleNotesChange,
        handler: applyNotesChange,
      },
    }))
    registrar.registerHook('Apollo-RegisterChecks', (checks) => [
      ...checks,
      new ExampleShortFeatureCheck(),
    ])
    registrar.registerHook('Apollo-RegisterValidations', (validations) => [
      ...validations,
      new ExampleNoteLengthRule(),
    ])
    registrar.registerHook('Apollo-RegisterRoutes', (routes) => [
      ...routes,
      notesRoute,
    ])
  }
}
