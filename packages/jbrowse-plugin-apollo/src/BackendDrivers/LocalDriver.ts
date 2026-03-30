/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/require-await */
import type { Change } from '@apollo-annotation/common'
import type {
  AnnotationFeatureSnapshot,
  CheckResultSnapshot,
} from '@apollo-annotation/mst'
import { ValidationResultSet } from '@apollo-annotation/shared'
import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type {
  BaseRefNameAliasAdapter,
  BaseSequenceAdapter,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import {
  type AbstractRootModel,
  type Region,
  getEnv,
  getSession,
} from '@jbrowse/core/util'

import type { SubmitOpts } from '../ChangeManager'

import { BackendDriver, type RefNameAliases } from './BackendDriver'

export class LocalDriver extends BackendDriver {
  async getFeatures(
    region: Region,
  ): Promise<[AnnotationFeatureSnapshot[], CheckResultSnapshot[]]> {
    return [[], []]
  }

  async getSequence(region: Region): Promise<{ seq: string; refSeq: string }> {
    const session = getSession(this.clientStore)
    const { assemblyManager } = session
    const assembly = await assemblyManager.waitForAssembly(region.assemblyName)
    if (!assembly) {
      throw new Error(`Assembly not found: "${region.assemblyName}"`)
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { configuration } = assembly
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const { adapter: adapterConf } = configuration.sequence
    const { pluginManager } = getEnv(this.clientStore)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    const type = pluginManager.getAdapterType(adapterConf.type)
    if (!type) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      throw new Error(`No adapter found for "${adapterConf.type}"`)
    }
    const CLASS = await type.getAdapterClass()
    const adapter = new CLASS(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      adapterConf,
      undefined,
      pluginManager,
    ) as BaseSequenceAdapter
    const seq = await adapter.getSequence(region)
    if (!seq) {
      throw new Error(`Sequence not found: ${JSON.stringify(region)}`)
    }
    return { seq, refSeq: region.refName }
  }

  async getRegions(assemblyName: string): Promise<Region[]> {
    const session = getSession(this.clientStore)
    const { assemblyManager } = session
    const assembly = await assemblyManager.waitForAssembly(assemblyName)
    if (!assembly) {
      throw new Error(`Assembly not found: "${assemblyName}"`)
    }
    const { regions } = assembly
    if (!regions) {
      throw new Error(`Assembly not found: "${assemblyName}"`)
    }
    return regions
  }

  getAssemblies(internetAccountConfigId?: string): Assembly[] {
    return []
  }

  async getRefNameAliases(assemblyName: string): Promise<RefNameAliases[]> {
    const session = getSession(this.clientStore)
    const { assemblyManager } = session
    const assembly = await assemblyManager.waitForAssembly(assemblyName)
    if (!assembly) {
      throw new Error(`Assembly not found: "${assemblyName}"`)
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { configuration } = assembly
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { refNameAliases } = configuration
    if (!refNameAliases) {
      return []
    }
    const { pluginManager } = getEnv(this.clientStore)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    const type = pluginManager.getAdapterType(refNameAliases.adapter.type)
    if (!type) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      throw new Error(`No adapter found for "${refNameAliases.adapter.type}"`)
    }
    const CLASS = await type.getAdapterClass()
    const adapter = new CLASS(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
      refNameAliases.adapter,
      undefined,
      pluginManager,
    ) as BaseRefNameAliasAdapter
    return adapter.getRefNameAliases({})
  }

  async submitChange(
    change: Change,
    opts: SubmitOpts,
  ): Promise<ValidationResultSet> {
    return new ValidationResultSet()
  }

  async searchFeatures(
    term: string,
    assemblies: string[],
  ): Promise<AnnotationFeatureSnapshot[]> {
    return []
  }
}
