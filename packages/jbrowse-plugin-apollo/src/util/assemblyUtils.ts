import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import { readConfObject } from '@jbrowse/core/configuration'

/** The metadata Apollo stores in an assembly's sequence configuration */
export interface ApolloAssemblyMetadata {
  apollo?: boolean
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
