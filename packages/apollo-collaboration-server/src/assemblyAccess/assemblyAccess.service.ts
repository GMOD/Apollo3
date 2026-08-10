import type {
  AssemblyAccess,
  AssemblyAccessProps,
  AssemblyGrant,
} from '@apollo-annotation/common'
import {
  Assembly,
  type AssemblyDocument,
  Feature,
  type FeatureDocument,
  RefSeq,
  type RefSeqDocument,
} from '@apollo-annotation/schemas'
import { Injectable, Logger } from '@nestjs/common'
import { InjectConnection, InjectModel } from '@nestjs/mongoose'
import type { Connection } from 'mongoose'
import { Model, Types } from 'mongoose'
import QuickLRU from 'quick-lru'

import { PluginsService } from '../plugins/plugins.service.js'
import type { RequestUser } from '../utils/requestWithUser.js'
import { Role } from '../utils/role/role.enum.js'

/** How long a resolved assembly name/alias to id map is reused */
const NAME_MAP_TTL_MS = 10_000

/** Extension point a plugin registers to restrict access to assemblies */
export const ASSEMBLY_ACCESS_EXTENSION_POINT = 'Apollo-AssemblyAccess'

/**
 * Change types that create the assembly they name, so their assembly id cannot
 * possibly have been granted yet.
 */
const ASSEMBLY_CREATING_CHANGES = new Set([
  'AddAssemblyAndFeaturesFromFileChange',
  'AddAssemblyFromExternalChange',
  'AddAssemblyFromFileChange',
])

export type AccessKind = 'assembly' | 'refSeq' | 'feature'

/**
 * Decides which assemblies a user may reach, asking the
 * `Apollo-AssemblyAccess` extension point. When no plugin registers it, or it
 * evaluates to `undefined`, every user may reach every assembly, which is how
 * Apollo behaves without this feature.
 *
 * Since features reference only a refSeq, and refSeqs reference an assembly,
 * authorizing a feature or refSeq means walking up to its assembly. Both hops
 * are immutable for the lifetime of a document, so they are cached.
 */
@Injectable()
export class AssemblyAccessService {
  constructor(
    @InjectModel(Assembly.name)
    private readonly assemblyModel: Model<AssemblyDocument>,
    @InjectModel(RefSeq.name)
    private readonly refSeqModel: Model<RefSeqDocument>,
    @InjectModel(Feature.name)
    private readonly featureModel: Model<FeatureDocument>,
    @InjectConnection()
    private readonly connection: Connection,
    private readonly pluginsService: PluginsService,
  ) {}

  private readonly logger = new Logger(AssemblyAccessService.name)

  private nameMap: { map: Map<string, string[]>; loadedAt: number } | undefined
  private nameMapPromise: Promise<Map<string, string[]>> | undefined

  private readonly refSeqToAssembly = new QuickLRU<string, string>({
    maxSize: 1000,
  })
  private readonly featureToRefSeq = new QuickLRU<string, string>({
    maxSize: 1000,
  })

  /** Granted names that matched no assembly, so we warn about each of them once */
  private readonly warnedNames = new Set<string>()

  /**
   * Ask the extension point which users may reach which assemblies.
   *
   * Evaluated on every call rather than cached, so a plugin can hand back
   * different grants as they change. A plugin that does expensive work to
   * answer should memoize internally.
   *
   * The database connection is handed to the plugin so it can look grants up in
   * Mongo, the same way the `Apollo-MongoDB` extension point does.
   *
   * @returns The access structure, or `undefined` when nothing restricts access
   */
  private async getAccessMap(): Promise<
    Map<string, AssemblyGrant> | undefined
  > {
    const evaluated = await this.pluginsService.evaluateExtensionPoint<
      AssemblyAccess | Promise<AssemblyAccess> | undefined
    >(ASSEMBLY_ACCESS_EXTENSION_POINT, undefined, {
      connection: this.connection,
    } satisfies AssemblyAccessProps)
    if (!evaluated) {
      // evaluateExtensionPoint swallows callback errors and leaves the
      // accumulator alone, so a plugin that throws looks exactly like no plugin
      // at all. That would silently grant everyone everything, so say so.
      if (this.hasAccessPlugin()) {
        this.logger.warn(
          `A plugin registers "${ASSEMBLY_ACCESS_EXTENSION_POINT}" but it evaluated to undefined, so all users have access to all assemblies. If that is not intended, check the logs above for an error thrown by the plugin.`,
        )
      }
      return undefined
    }
    // What a plugin hands back is untrusted, so check its shape rather than
    // taking the declared type at face value
    const access: unknown = evaluated
    if (access instanceof Map) {
      return access as Map<string, AssemblyGrant>
    }
    if (typeof access === 'object') {
      return new Map(Object.entries(access as Record<string, AssemblyGrant>))
    }
    // Refuse to guess. Returning undefined here would open up every assembly.
    this.logger.error(
      `"${ASSEMBLY_ACCESS_EXTENSION_POINT}" evaluated to a ${typeof access}, expected a Map or an object. No user will have access to any assembly until this is fixed.`,
    )
    return new Map()
  }

  private hasAccessPlugin() {
    const callbacks = this.pluginsService.extensionPoints.get(
      ASSEMBLY_ACCESS_EXTENSION_POINT,
    )
    return callbacks !== undefined && callbacks.length > 0
  }

  /**
   * The assemblies this user may reach, or `undefined` if they are
   * unrestricted. An empty array means they may reach nothing.
   */
  async getAllowedAssemblyIds(
    user?: RequestUser,
  ): Promise<string[] | undefined> {
    const access = await this.getAccessMap()
    if (!access) {
      return undefined
    }
    const grant = this.getGrant(user, access)
    if (grant === '*') {
      return undefined
    }
    if (grant.length === 0) {
      return []
    }
    const nameMap = await this.getNameMap()
    const ids = new Set<string>()
    for (const name of grant) {
      const matches = nameMap.get(name)
      if (!matches) {
        if (!this.warnedNames.has(name)) {
          this.warnedNames.add(name)
          this.logger.warn(
            `"${ASSEMBLY_ACCESS_EXTENSION_POINT}" grants "${name}", which matches no assembly`,
          )
        }
        continue
      }
      for (const id of matches) {
        ids.add(id)
      }
    }
    return [...ids]
  }

  canAccessAssembly(allowedAssemblyIds: string[], assemblyId: string) {
    return allowedAssemblyIds.includes(assemblyId)
  }

  async canAccessRefSeq(allowedAssemblyIds: string[], refSeqId: string) {
    const assemblyId = await this.getAssemblyForRefSeq(refSeqId)
    return assemblyId !== undefined && allowedAssemblyIds.includes(assemblyId)
  }

  async canAccessFeature(allowedAssemblyIds: string[], featureId: string) {
    const refSeqId = await this.getRefSeqForFeature(featureId)
    if (!refSeqId) {
      return false
    }
    return this.canAccessRefSeq(allowedAssemblyIds, refSeqId)
  }

  /**
   * @param allowedAssemblyIds - The assemblies the user may reach, as resolved
   * once by the caller. Unrestricted users never get this far.
   */
  async canAccess(
    allowedAssemblyIds: string[],
    kind: AccessKind,
    id: string,
  ): Promise<boolean> {
    switch (kind) {
      case 'assembly': {
        return this.canAccessAssembly(allowedAssemblyIds, id)
      }
      case 'refSeq': {
        return this.canAccessRefSeq(allowedAssemblyIds, id)
      }
      case 'feature': {
        return this.canAccessFeature(allowedAssemblyIds, id)
      }
    }
  }

  /**
   * Authorize a submitted change. Changes that create their own assembly are
   * only allowed for unrestricted users, since a user confined to particular
   * assemblies has no business minting new ones.
   */
  canSubmitChange(
    allowedAssemblyIds: string[],
    change: { typeName?: string; assembly?: string },
  ) {
    const { assembly, typeName } = change
    if (!assembly) {
      // Not an assembly-specific change, the role checks already cover it
      return true
    }
    if (typeName && ASSEMBLY_CREATING_CHANGES.has(typeName)) {
      return false
    }
    return allowedAssemblyIds.includes(assembly)
  }

  private getGrant(
    user: RequestUser | undefined,
    access: Map<string, AssemblyGrant>,
  ): AssemblyGrant {
    // Anonymous requests get a pseudo-user with no email, see JwtAuthGuard
    if (!user?.email) {
      return []
    }
    // A safety net, so a plugin that forgets to list admins cannot lock anyone
    // out of administering the server
    if (user.role === Role.Admin) {
      return '*'
    }
    return access.get(user.email) ?? []
  }

  /**
   * Assembly names, display names, aliases and ids mapped to assembly ids. Must
   * be resolved lazily rather than at startup, since assemblies are created
   * while the server runs.
   */
  private async getNameMap(): Promise<Map<string, string[]>> {
    const cached = this.nameMap
    if (cached && Date.now() - cached.loadedAt < NAME_MAP_TTL_MS) {
      return cached.map
    }
    this.nameMapPromise ??= this.buildNameMap()
    try {
      return await this.nameMapPromise
    } finally {
      this.nameMapPromise = undefined
    }
  }

  private async buildNameMap() {
    const assemblies = await this.assemblyModel.find({ status: 0 }).exec()
    const map = new Map<string, string[]>()
    const add = (key: string, id: string) => {
      const ids = map.get(key)
      if (!ids) {
        map.set(key, [id])
        return
      }
      if (!ids.includes(id)) {
        ids.push(id)
        this.logger.warn(
          `Assembly name "${key}" matches more than one assembly, access rules using it apply to all of them`,
        )
      }
    }
    for (const assembly of assemblies) {
      const id = assembly._id.toHexString()
      add(id, id)
      for (const name of [
        assembly.name,
        assembly.displayName,
        ...assembly.aliases,
      ]) {
        if (name) {
          add(name, id)
        }
      }
    }
    this.nameMap = { map, loadedAt: Date.now() }
    return map
  }

  private async getAssemblyForRefSeq(refSeqId: string) {
    const cached = this.refSeqToAssembly.get(refSeqId)
    if (cached) {
      return cached
    }
    if (!Types.ObjectId.isValid(refSeqId)) {
      return
    }
    const refSeq = await this.refSeqModel
      .findById(refSeqId, { assembly: 1 })
      .lean<{ assembly: Types.ObjectId } | null>()
      .exec()
    if (!refSeq) {
      return
    }
    const assemblyId = refSeq.assembly.toHexString()
    this.refSeqToAssembly.set(refSeqId, assemblyId)
    return assemblyId
  }

  private async getRefSeqForFeature(featureId: string) {
    const cached = this.featureToRefSeq.get(featureId)
    if (cached) {
      return cached
    }
    // Child feature ids live in allIds, not _id, which is how FeaturesService
    // looks features up as well
    const feature = await this.featureModel
      .findOne({ allIds: featureId }, { refSeq: 1 })
      .lean<{ refSeq: Types.ObjectId } | null>()
      .exec()
    if (!feature) {
      return
    }
    const refSeqId = feature.refSeq.toHexString()
    this.featureToRefSeq.set(featureId, refSeqId)
    return refSeqId
  }
}
