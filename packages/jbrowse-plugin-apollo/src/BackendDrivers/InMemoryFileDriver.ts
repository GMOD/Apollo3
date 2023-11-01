import { getConf } from '@jbrowse/core/configuration'
import { Region, getSession } from '@jbrowse/core/util'
import { AssemblySpecificChange, Change } from 'apollo-common'
import { AnnotationFeatureSnapshot } from 'apollo-mst'
import { ValidationResultSet } from 'apollo-shared'

import { SubmitOpts } from '../ChangeManager'
import { BackendDriver } from './BackendDriver'

export class InMemoryFileDriver extends BackendDriver {
  async getFeatures(): Promise<AnnotationFeatureSnapshot[]> {
    return []
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
        | { apollo: boolean; internetAccountConfigId?: string }
        | undefined
      return Boolean(
        sequenceMetadata &&
          sequenceMetadata.apollo &&
          !sequenceMetadata.internetAccountConfigId,
      )
    })
  }

  async submitChange(
    _change: Change | AssemblySpecificChange,
    _opts: SubmitOpts = {},
  ) {
    return new ValidationResultSet()
  }

  async searchFeatures(
    _term: string,
    _assemblies: string[],
  ): Promise<AnnotationFeatureSnapshot[]> {
    return []
  }
}
