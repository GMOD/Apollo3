import { Region } from '@jbrowse/core/util'

import { Change } from '../ChangeManager/Change'
import { ValidationResultSet } from '../Validations/ValidationSet'
import { AnnotationFeatureI } from './AnnotationFeatures'

export abstract class BackendDriver {
  constructor(
    private clientStore: any, // TODO add client store
  ) {}

  abstract getFeatures(region: Region): AnnotationFeatureI

  loadFeatures(region: Region): void {
    const features = this.getFeatures(region)
    this.clientStore.load(features)
  }

  abstract getSequence(region: Region): string

  abstract submitChange(change: Change): ValidationResultSet
}
