import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import {
  type AnyConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'
import type { AbstractSessionModel } from '@jbrowse/core/util'

/** The metadata Apollo stores in an assembly's sequence configuration */
export interface ApolloAssemblyMetadata {
  apollo?: boolean
  apolloId?: string
  file?: string
}

/** Read Apollo's metadata from an assembly's sequence configuration */
export function getAssemblyMetadata(
  assembly: Assembly,
): ApolloAssemblyMetadata {
  const { configuration } = assembly
  if (!configuration) {
    return {}
  }
  const metadata = readConfObject(configuration, ['sequence', 'metadata']) as
    | ApolloAssemblyMetadata
    | undefined
  return metadata ?? {}
}

/**
 * Normalizes a JBrowse assembly to its underlying configuration model.
 * JBrowse's own ambient types are inconsistent about assembly shape between
 * `assemblyManager.get()` (an `Assembly` instance, wrapping a
 * `.configuration` model) and `assemblyManager.assemblyList` (bare
 * configuration models directly) - this accepts either.
 */
function getAssemblyConfigModel(assembly: unknown): AnyConfigurationModel {
  return ((assembly as { configuration?: AnyConfigurationModel })
    .configuration ?? assembly) as AnyConfigurationModel
}

/**
 * Reads a JBrowse assembly's `sequence.metadata` config slot, the object
 * the collaboration server embeds `{ apollo: true, apolloId: <backend id> }`
 * into for every assembly it serves (see `JBrowseService.getConfig`).
 */
export function getAssemblySequenceMetadata(assembly: unknown): {
  apollo?: boolean
  apolloId?: string
} {
  return (readConfObject(getAssemblyConfigModel(assembly), [
    'sequence',
    'metadata',
  ]) ?? {}) as { apollo?: boolean; apolloId?: string }
}

/**
 * Resolves the Apollo collaboration-server backend id for a JBrowse
 * assembly. The JBrowse assembly `name` itself is left as the
 * human-readable config name and is never the backend id (see
 * `getAssemblySequenceMetadata`); an assembly with no `apolloId` metadata
 * has no backend document at all (e.g. one served entirely by LocalDriver),
 * so this falls back to the assembly's own `name`.
 */
export function getApolloAssemblyId(assembly: unknown): string {
  const { apolloId } = getAssemblySequenceMetadata(assembly)
  return (
    apolloId ??
    (readConfObject(getAssemblyConfigModel(assembly), 'name') as string)
  )
}

/** Reads a JBrowse assembly's `displayName`, falling back to `name`. */
export function getAssemblyDisplayName(assembly: unknown): string {
  const configModel = getAssemblyConfigModel(assembly)
  return (
    (readConfObject(configModel, 'displayName') as string | undefined) ??
    (readConfObject(configModel, 'name') as string)
  )
}

/**
 * Finds a JBrowse assembly *instance* (the live object with methods like
 * `getCanonicalRefName`, as returned by `assemblyManager.get()` - not just
 * its bare config) by either its JBrowse `name` or its resolved Apollo
 * backend id (see `getApolloAssemblyId`). Needed because
 * `assemblyManager.get()` only indexes assemblies by `name`, while several
 * callers only have the already-resolved backend id on hand: when `nameOrId`
 * isn't a known name, this resolves it to a name via `assemblyList` first,
 * then looks that up, so the result is always a full instance (or
 * `undefined`), never a bare config model.
 */
export function findAssemblyByNameOrId(
  assemblyManager: AbstractSessionModel['assemblyManager'],
  nameOrId: string,
) {
  const direct = assemblyManager.get(nameOrId)
  if (direct) {
    return direct
  }
  const config = assemblyManager.assemblyList.find(
    (assembly) => getApolloAssemblyId(assembly) === nameOrId,
  )
  if (!config) {
    return
  }
  const name = readConfObject(getAssemblyConfigModel(config), 'name') as string
  return assemblyManager.get(name)
}

/**
 * The user's Apollo role for an assembly. Assemblies that aren't served by a
 * collaboration server (local-only assemblies) are always fully editable, so
 * they get "admin". Otherwise it's the role in the plugin configuration that
 * the collaboration server provides.
 */
export function getApolloRole(
  session: { getPluginConfiguration(): AnyConfigurationModel },
  assembly: Assembly,
) {
  if (!getAssemblyMetadata(assembly).apollo) {
    return 'admin'
  }
  return readConfObject(session.getPluginConfiguration(), 'role') as
    | string
    | undefined
}
