/* eslint-disable @typescript-eslint/require-await */
import {
  type AssemblySpecificChange,
  type Change,
} from '@apollo-annotation/common'
import {
  type AnnotationFeatureSnapshot,
  type CheckResultSnapshot,
} from '@apollo-annotation/mst'
import { ValidationResultSet } from '@apollo-annotation/shared'
import { getConf } from '@jbrowse/core/configuration'
import { type Region, getSession } from '@jbrowse/core/util'

import { type SubmitOpts } from '../ChangeManager'
import { checkFeatures } from '../util'

import { BackendDriver, type RefNameAliases } from './BackendDriver'

export class InMemoryFileDriver extends BackendDriver {
  getFeatureById(
    _featureId: string,
    _assemblyName: string,
    _topLevel: boolean,
  ): Promise<AnnotationFeatureSnapshot | undefined> {
    throw new Error('Method not implemented.')
  }

  async getFeatures(): Promise<
    [AnnotationFeatureSnapshot[], CheckResultSnapshot[]]
  > {
    return [[], []]
  }

  async getSequence(region: Region) {
    const { assemblyName, end, refName, start } = region
    const assembly = this.clientStore.assemblies.get(assemblyName)
    if (!assembly) {
      return { seq: '', refSeq: refName }
    }
    const refSeq = assembly.refSeqs.get(refName)
    if (!refSeq) {
      return { seq: '', refSeq: refName }
    }
    const seq = refSeq.getSequence(start, end)
    return { seq, refSeq: refName }
  }

  async getRefNameAliases(assemblyName: string): Promise<RefNameAliases[]> {
    const assembly = this.clientStore.assemblies.get(assemblyName)
    const refNameAliases: RefNameAliases[] = []
    if (!assembly) {
      return refNameAliases
    }
    for (const [, refSeq] of assembly.refSeqs) {
      refNameAliases.push({
        refName: refSeq.name,
        aliases: [refSeq._id],
        uniqueId: `alias-${refSeq._id}`,
      })
    }
    return refNameAliases
  }

  async getRegions(assemblyName: string): Promise<Region[]> {
    const assembly = this.clientStore.assemblies.get(assemblyName)
    if (!assembly) {
      return []
    }
    const regions: Region[] = []
    for (const [, refSeq] of assembly.refSeqs) {
      regions.push({
        assemblyName,
        refName: refSeq.name,
        start: refSeq.sequence[0].start,
        end: refSeq.sequence[0].stop,
      })
    }
    return regions
  }

  getAssemblies() {
    const { assemblyManager } = getSession(this.clientStore)
    return assemblyManager.assemblies.filter((assembly) => {
      const sequenceMetadata = getConf(assembly, ['sequence', 'metadata']) as
        | { apollo: boolean; internetAccountConfigId?: string; file?: string }
        | undefined
      return Boolean(
        sequenceMetadata &&
          sequenceMetadata.apollo &&
          !sequenceMetadata.file &&
          !sequenceMetadata.internetAccountConfigId,
      )
    })
  }

  async submitChange(
    _change: Change | AssemblySpecificChange,
    _opts: SubmitOpts = {},
  ) {
    const { clientStore } = this
    const { assemblies } = clientStore
    clientStore.clearCheckResults()
    for (const [, assembly] of assemblies) {
      if (assembly.backendDriverType === 'InMemoryFileDriver') {
        const checkResults = await checkFeatures(assembly)
        clientStore.addCheckResults(checkResults)
      }
    }
    return new ValidationResultSet()
  }

  async searchFeatures(
    _term: string,
    _assemblies: string[],
  ): Promise<AnnotationFeatureSnapshot[]> {
    return []
  }
}
