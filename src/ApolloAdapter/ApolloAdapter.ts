import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { NoAssemblyRegion } from '@jbrowse/core/util/types'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import SimpleFeature, { Feature } from '@jbrowse/core/util/simpleFeature'
import { Instance } from 'mobx-state-tree'
// import honeybeeResponse from './test_data/honeybeeGroup1.10.json'
import volvoxResponse from './test_data/volovox_ctgA.json'

import MyConfigSchema from './configSchema'

const sampleFeature = volvoxResponse.features[0]
type ApolloFeature = typeof sampleFeature

export default class ApolloAdapter extends BaseFeatureDataAdapter {
  private refNames = ['ctgA']

  public constructor(config: Instance<typeof MyConfigSchema>) {
    super(config)
  }

  public async getRefNames(_opts: BaseOptions = {}): Promise<string[]> {
    return this.refNames
  }

  public getFeatures(query: NoAssemblyRegion, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      if (query.refName === 'ctgA') {
        volvoxResponse.features.forEach(f => {
          observer.next(this.apolloFeatureToFeature(f))
        })
      }
      observer.complete()
    }, opts.signal)
  }

  public apolloFeatureToFeature(feature: ApolloFeature): Feature {
    const { location } = feature
    let subfeatures
    if (feature.children) {
      subfeatures = []
      feature.children.forEach((child: any) => {
        subfeatures.push(this.apolloFeatureToFeature(child))
      })
    }
    return new SimpleFeature({
      ...feature,
      refName: feature.sequence,
      uniqueId: feature.uniquename,
      start: location.fmin,
      end: location.fmax,
      strand: location.strand,
      subfeatures,
    })
  }

  public async hasDataForRefName(
    refName: string,
    _opts: BaseOptions = {},
  ): Promise<boolean> {
    if (refName === 'ctgA') {
      return true
    }
    return false
  }

  public freeResources(/* { region } */): void {}
}
