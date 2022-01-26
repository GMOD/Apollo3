import { Region } from '@jbrowse/core/util'
import { SnapshotIn } from 'mobx-state-tree'

import { Change, ClientDataStore } from '../ChangeManager/Change'
import { ValidationResultSet } from '../Validations/ValidationSet'
import { AnnotationFeature } from './AnnotationFeature'

export abstract class BackendDriver {
  constructor(protected clientStore: ClientDataStore) {}

  abstract getFeatures(
    region: Region,
  ): Promise<
    Record<
      string,
      | Record<string, SnapshotIn<typeof AnnotationFeature> | undefined>
      | undefined
    >
  >

  async loadFeatures(region: Region): Promise<void> {
    const features = await this.getFeatures(region)
    this.clientStore.load(features)
  }

  abstract getSequence(region: Region): Promise<string>

  abstract getRefNames(): Promise<string[]>

  abstract submitChange(change: Change): Promise<ValidationResultSet>
}
