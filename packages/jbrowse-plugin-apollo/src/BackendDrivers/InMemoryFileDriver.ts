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

  async submitChange(
    _change: Change | AssemblySpecificChange,
    _opts: SubmitOpts = {},
  ) {
    return new ValidationResultSet()
  }
}
