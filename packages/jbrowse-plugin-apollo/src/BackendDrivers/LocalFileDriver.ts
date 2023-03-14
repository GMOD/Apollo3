import { Region } from '@jbrowse/core/util'
import { AssemblySpecificChange, Change } from 'apollo-common'
import { ValidationResultSet } from 'apollo-shared'

import { SubmitOpts } from '../ChangeManager'
import { BackendDriver } from './BackendDriver'

export class LocalFileDriver extends BackendDriver {
  async getFeatures(region: Region) {
    throw new Error('To be implemented')
    return []
  }

  async getSequence(region: Region) {
    throw new Error('To be implemented')
    return ''
  }

  async getRefSeqs() {
    throw new Error('To be implemented')
    return []
  }

  async submitChange(
    change: Change | AssemblySpecificChange,
    opts: SubmitOpts = {},
  ) {
    throw new Error('To be implemented')
    return new ValidationResultSet()
  }
}
