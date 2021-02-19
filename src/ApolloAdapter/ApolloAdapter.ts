import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { intersection2 } from '@jbrowse/core/util/range'
import { NoAssemblyRegion } from '@jbrowse/core/util/types'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import SimpleFeature, { Feature } from '@jbrowse/core/util/simpleFeature'
import { Instance } from 'mobx-state-tree'
import { apolloFetch } from '../apolloFetch'
import ConfigSchema from './configSchema'
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'

type ApolloFeature = any

export default class ApolloAdapter extends BaseFeatureDataAdapter {
  private refNames: string[] = []

  private apolloConfig: AnyConfigurationModel

  public constructor(config: Instance<typeof ConfigSchema>) {
    super(config)
    this.apolloConfig = config.apolloConfig
  }

  public async getRefNames(
    opts: BaseOptions & { username?: string; password?: string },
  ): Promise<string[]> {
    if (this.refNames.length) {
      return this.refNames
    }
    const { signal, username, password, assemblyName } = opts
    const data = { organism: assemblyName }
    try {
      const response = await apolloFetch(
        this.apolloConfig,
        'organism/getSequencesForOrganism',
        { body: JSON.stringify(data), signal: signal },
        { username, password },
      )
      if (response.ok) {
        const result = (await response.json()) as SequencesResponse
        return result.sequences.map(seq => seq.name)
      } else {
        console.error(response.statusText)
      }
    } catch (error) {
      console.error(error)
    }
    return this.refNames
  }

  public getFeatures(
    query: NoAssemblyRegion,
    opts: BaseOptions & { username?: string; password?: string } = {},
  ) {
    const { refName, start, end } = query
    const { signal, username, password, assemblyName } = opts
    return ObservableCreate<Feature>(async observer => {
      const data = {
        organism: assemblyName,
        sequence: refName,
      }
      try {
        const response = await apolloFetch(
          this.apolloConfig,
          'annotationEditor/getFeatures',
          { body: JSON.stringify(data), signal },
          { username, password },
        )
        if (response.ok) {
          const result = await response.json()
          const features = result.features.filter(
            (feature: any) =>
              intersection2(
                start,
                end,
                feature.location.fmin,
                feature.location.fmax,
              ).length,
          )
          features.forEach((f: ApolloFeature) => {
            observer.next(this.apolloFeatureToFeature(f))
          })
          observer.complete()
        } else {
          observer.error(
            new Error(`${response.statusText} (${response.status})`),
          )
        }
      } catch (error) {
        observer.error(error)
      }
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
    opts: BaseOptions = {},
  ): Promise<boolean> {
    const refNames = await this.getRefNames(opts)
    return refNames.includes(refName)
  }

  public freeResources(/* { region } */): void {}
}
