import { Region } from '@jbrowse/core/util'
import { AnnotationFeatureLocationSnapshot } from 'apollo-mst'

import { Change, ClientDataStore } from '../ChangeManager/Change'
import { ValidationResultSet } from '../Validations/ValidationSet'

// Doing this because `SnapshotIn<typeof FeaturesForRefName>` for some reason
// resolves to `any`, so this offers better typechecking.
export type FeaturesForRefNameSnapshot = Record<
  string,
  Record<string, AnnotationFeatureLocationSnapshot | undefined> | undefined
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
