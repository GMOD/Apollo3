import { Region } from '@jbrowse/core/util'

import { Change } from '../ChangeManager/Change'
import { ValidationResultSet } from '../Validations/ValidationSet'
import { AnnotationFeatureI } from './AnnotationFeatures'

export abstract class BackendDriver {
  constructor(
    private clientStore: any, // TODO add client store
  ) {}

  abstract getFeatures(region: Region): Promise<AnnotationFeatureI>

  async loadFeatures(region: Region): Promise<void> {
    const features = await this.getFeatures(region)
    this.clientStore.load(features)
  }

  abstract getSequence(region: Region): Promise<string>

  abstract getRefNames(): Promise<Region[]>

  abstract submitChange(change: Change): Promise<ValidationResultSet>
}
