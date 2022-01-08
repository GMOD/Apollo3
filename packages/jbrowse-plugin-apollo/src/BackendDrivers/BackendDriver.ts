import { Region } from '@jbrowse/core/util'

import { Change } from '../ChangeManager/Change'
import { ValidationResultSet } from '../Validations/ValidationSet'

export abstract class BackendDriver {
  constructor(
    private clientStore: any, // TODO add client store
  ) {}

  abstract getFeatures(region: Region): any // ApolloFeature snapshot in

  loadFeatures(region: Region): void {
    const features = this.getFeatures(region)
    this.clientStore.load(features)
  }

  abstract getSequence(region: Region): string

  abstract submitChange(change: Change): ValidationResultSet
}
