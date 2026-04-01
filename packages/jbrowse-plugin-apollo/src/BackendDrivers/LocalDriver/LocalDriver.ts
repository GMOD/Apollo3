/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/require-await */
import {
  type Change,
  FeatureChange,
  type SerializedChange,
  isFeatureChange,
} from '@apollo-annotation/common'
import type {
  AnnotationFeature,
  AnnotationFeatureSnapshot,
  CheckResultSnapshot,
} from '@apollo-annotation/mst'
import {
  ValidationResultSet,
  isDeleteFeatureChange,
} from '@apollo-annotation/shared'
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
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import type { SubmitOpts } from '../../ChangeManager'
import {
  BackendDriver,
  type ChangeDocument,
  type RefNameAliases,
} from '../BackendDriver'

import { type FeatureDatabase, openDb } from './db'

export class LocalDriver extends BackendDriver {
  async getFeatures(
    region: Region,
  ): Promise<[AnnotationFeatureSnapshot[], CheckResultSnapshot[]]> {
    const { assemblyName, end, refName, start } = region
    const regions = await this.getRegions(assemblyName)
    const refNames = regions.map((r) => r.refName)
    const db = await openDb(assemblyName, refNames)
    const storeName = `features-${refName}`
    const features: AnnotationFeatureSnapshot[] = []
    for await (const cursor of db
      .transaction(storeName)
      .store.index('min')
      .iterate(IDBKeyRange.upperBound(end, true))) {
      if ((cursor.value as { max: number }).max > start) {
        features.push(cursor.value as AnnotationFeatureSnapshot)
      }
    }
    return [features, []]
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
    if (!isFeatureChange(change)) {
      return new ValidationResultSet()
    }
    const { assembly, changedIds } = change
    const regions = await this.getRegions(assembly)
    const refNames = regions.map((r) => r.refName)
    const db = await openDb(assembly, refNames)
    const storeNames = refNames.map((r) => `features-${r}`)
    storeNames.push('changes')
    const tx = db.transaction(storeNames, 'readwrite')
    const topLevelFeatures = new Set<AnnotationFeature>()
    if (isDeleteFeatureChange(change)) {
      for (const c of change.changes) {
        if (c.parentFeatureId) {
          const feature = this.clientStore.getFeature(c.parentFeatureId)
          if (feature) {
            topLevelFeatures.add(feature.topLevelFeature)
          }
        } else {
          const { refSeq } = c.deletedFeature
          void tx.objectStore(`features-${refSeq}`).delete(c.deletedFeature._id)
        }
      }
    } else {
      for (const changedId of changedIds) {
        const feature = this.clientStore.getFeature(changedId)
        if (feature) {
          topLevelFeatures.add(feature.topLevelFeature)
        }
      }
    }
    for (const feature of topLevelFeatures) {
      const snapshot = getSnapshot<AnnotationFeatureSnapshot>(feature)
      void tx
        .objectStore(`features-${feature.refSeq}`)
        .put(snapshot, feature._id)
    }
    void tx
      .objectStore('changes')
      .put({ ...change.toJSON(), createdAt: new Date() })
    await tx.done
    return new ValidationResultSet()
  }

  async searchFeatures(
    term: string,
    assemblies: string[],
  ): Promise<AnnotationFeatureSnapshot[]> {
    return []
  }

  async getChanges(assemblyName: string): Promise<ChangeDocument[]> {
    const regions = await this.getRegions(assemblyName)
    const refNames = regions.map((r) => r.refName)
    const db = await openDb(assemblyName, refNames)
    const changes: ChangeDocument[] = []
    for await (const cursor of db.transaction('changes').store.iterate()) {
      changes.push({
        sequence: cursor.key,
        ...(cursor.value as SerializedChange & { createdAt: string }),
      })
    }
    return changes
  }
}
