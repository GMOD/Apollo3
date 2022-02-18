import { Region } from '@jbrowse/core/util'
import { SnapshotIn } from 'mobx-state-tree'

import { Change, ClientDataStore } from '../ChangeManager/Change'
import { ValidationResultSet } from '../Validations/ValidationSet'
import { AnnotationFeature } from './AnnotationFeature'

type FeaturesForRefNameSnapshot = Record<
  string,
  Record<string, SnapshotIn<typeof AnnotationFeature> | undefined> | undefined
>

export abstract class BackendDriver {
  constructor(protected clientStore: ClientDataStore) {}

  abstract getFeatures(region: Region): Promise<FeaturesForRefNameSnapshot>

  async loadFeatures(regions: Region[]): Promise<void> {
    const features: FeaturesForRefNameSnapshot = {}
    const regionFeaturesP = regions.map((region) => this.getFeatures(region))
    const regionFeatures = await Promise.all(regionFeaturesP)
    regionFeatures.forEach((featureGroup) => {
      Object.entries(featureGroup).forEach(([refName, feats]) => {
        if (features[refName]) {
          features[refName] = { ...features[refName], ...feats }
        } else {
          features[refName] = feats
        }
      })
    })
    this.clientStore.load(features)
  }

  abstract getSequence(region: Region): Promise<string>

  abstract getRefNames(): Promise<string[]>

  abstract submitChange(change: Change): Promise<ValidationResultSet>
}
