/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/require-await */
import {
  type Change,
  type SerializedChange,
  checkRegistry,
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
    const featureStoreName = `features-${refName}`
    const checkStoreName = `checkresults-${refName}`
    const features: AnnotationFeatureSnapshot[] = []
    const checkResults: CheckResultSnapshot[] = []
    const tx = db.transaction([featureStoreName, checkStoreName])
    for await (const cursor of tx
      .objectStore(featureStoreName)
      .index('min')
      .iterate(IDBKeyRange.upperBound(end, true))) {
      if ((cursor.value as { max: number }).max > start) {
        features.push(cursor.value as AnnotationFeatureSnapshot)
      }
    }
    for await (const cursor of tx
      .objectStore(checkStoreName)
      .index('min')
      .iterate(IDBKeyRange.upperBound(end, true))) {
      if ((cursor.value as { end: number }).end > start) {
        checkResults.push(cursor.value as CheckResultSnapshot)
      }
    }
    return [features, checkResults]
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
    const topLevelFeatures = new Set<AnnotationFeature>()
    const deletedFeatureIds: { refSeq: string; featureId: string }[] = []
    const neededRefNames = new Set<string>()
    if (isDeleteFeatureChange(change)) {
      for (const c of change.changes) {
        if (c.parentFeatureId) {
          const feature = this.clientStore.getFeature(c.parentFeatureId)
          if (feature) {
            topLevelFeatures.add(feature.topLevelFeature)
            neededRefNames.add(feature.topLevelFeature.refSeq)
          }
        } else {
          const { refSeq, _id } = c.deletedFeature
          deletedFeatureIds.push({ refSeq, featureId: _id })
          neededRefNames.add(refSeq)
        }
      }
    } else {
      for (const changedId of changedIds) {
        const feature = this.clientStore.getFeature(changedId)
        if (feature) {
          topLevelFeatures.add(feature.topLevelFeature)
          neededRefNames.add(feature.refSeq)
        }
      }
    }
    const storeNames = [...neededRefNames].flatMap((r) => [
      `features-${r}`,
      `checkresults-${r}`,
    ])
    storeNames.push('changes')
    const tx = db.transaction(storeNames, 'readwrite')
    for (const { refSeq, featureId } of deletedFeatureIds) {
      void tx.objectStore(`features-${refSeq}`).delete(featureId)
    }
    for (const feature of topLevelFeatures) {
      const snapshot = getSnapshot<AnnotationFeatureSnapshot>(feature)
      void tx
        .objectStore(`features-${feature.refSeq}`)
        .put(snapshot, feature._id)
    }
    // Delete old check results for deleted features
    for (const { featureId, refSeq } of deletedFeatureIds) {
      const checkStore = tx.objectStore(`checkresults-${refSeq}`)
      for await (const cursor of checkStore
        .index('featureId')
        .iterate(featureId)) {
        this.clientStore.deleteCheckResult(
          (cursor.value as CheckResultSnapshot)._id,
        )
        void cursor.delete()
      }
    }
    // Delete old check results for modified features
    for (const feature of topLevelFeatures) {
      const checkStore = tx.objectStore(`checkresults-${feature.refSeq}`)
      for await (const cursor of checkStore
        .index('featureId')
        .iterate(feature._id)) {
        this.clientStore.deleteCheckResult(
          (cursor.value as CheckResultSnapshot)._id,
        )
        void cursor.delete()
      }
    }
    void tx
      .objectStore('changes')
      .put({ ...change.toJSON(), createdAt: new Date() })
    await tx.done

    // Run checks on modified features. Collect all results first since checks
    // are async (need sequence data) and would cause the transaction to auto-commit.
    if (topLevelFeatures.size > 0) {
      const checks = [...checkRegistry.getChecks().values()]
      const allResults: {
        refSeq: string
        result: CheckResultSnapshot
        topLevelFeatureId: string
      }[] = []
      for (const feature of topLevelFeatures) {
        const snapshot = getSnapshot<AnnotationFeatureSnapshot>(feature)
        const getSequence = async (start: number, end: number) => {
          const result = await this.getSequence({
            assemblyName: assembly,
            refName: feature.refSeq,
            start,
            end,
          })
          return result.seq
        }
        for (const check of checks) {
          const results = await check.checkFeature(snapshot, getSequence)
          for (const result of results) {
            allResults.push({
              refSeq: feature.refSeq,
              result,
              topLevelFeatureId: feature._id,
            })
          }
        }
      }
      if (allResults.length > 0) {
        const checkStoreNames = refNames.map((r) => `checkresults-${r}`)
        const checkTx = db.transaction(checkStoreNames, 'readwrite')
        for (const { refSeq, result, topLevelFeatureId } of allResults) {
          void checkTx
            .objectStore(`checkresults-${refSeq}`)
            .put({ ...result, featureId: topLevelFeatureId })
        }
        await checkTx.done
        // Add new check results to client store
        for (const { result } of allResults) {
          this.clientStore.addCheckResult(result)
        }
      }
    }

    return new ValidationResultSet()
  }

  async searchFeatures(
    term: string,
    assemblies: string[],
  ): Promise<AnnotationFeatureSnapshot[]> {
    return []
  }

  async getCheckResults(assemblyName: string): Promise<CheckResultSnapshot[]> {
    const regions = await this.getRegions(assemblyName)
    const refNames = regions.map((r) => r.refName)
    const db = await openDb(assemblyName, refNames)
    const checkResults: CheckResultSnapshot[] = []
    const storeNames = refNames.map((r) => `checkresults-${r}`)
    const tx = db.transaction(storeNames)
    for (const storeName of storeNames) {
      for await (const cursor of tx.objectStore(storeName).iterate()) {
        checkResults.push(cursor.value as CheckResultSnapshot)
      }
    }
    return checkResults
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
