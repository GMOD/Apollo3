import { getConf } from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'
import { AssemblySpecificChange, Change } from 'apollo-common'
import { AnnotationFeatureSnapshot } from 'apollo-mst'
import { ValidationResultSet } from 'apollo-shared'

import { SubmitOpts } from '../ChangeManager'
import { BackendDriver } from './BackendDriver'

export class InMemoryFileDriver extends BackendDriver {
  async getFeatures(): Promise<AnnotationFeatureSnapshot[]> {
    return []
  }

  async getSequence() {
    return { seq: '', refSeq: '' }
  }

  async getRefSeqs() {
    return []
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
    term: string,
    assemblies: string[],
  ): Promise<AnnotationFeatureSnapshot[]> {
    return []
  }
}
