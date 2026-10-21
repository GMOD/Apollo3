import { SetMetadata } from '@nestjs/common'

import type { AccessKind } from './assemblyAccess.service.js'

export const ASSEMBLY_ACCESS_KEY = 'assemblyAccess'

export interface AssemblyAccessSpec {
  /**
   * What the id refers to. `change` reads the assembly out of a serialized
   * change request body.
   */
  kind: AccessKind | 'change'
  /** Where to find the id, defaults to `query`. Unused for `change`. */
  in?: 'query' | 'params' | 'body'
  /** Key of the id within `in`. Unused for `change`. */
  key?: string
  /** The value holds several ids, as an array or a comma-separated string */
  list?: boolean
  /**
   * Allow the value to be absent. Use for endpoints where an absent id means
   * "everything" and the service filters by the allowed assemblies instead.
   */
  optional?: boolean
}

/**
 * Declares which assembly, refSeq or feature ids an endpoint accepts, so
 * `AssemblyAccessGuard` can check them against the assembly allowlist.
 */
export const AssemblyAccess = (...specs: AssemblyAccessSpec[]) =>
  SetMetadata(ASSEMBLY_ACCESS_KEY, specs)
