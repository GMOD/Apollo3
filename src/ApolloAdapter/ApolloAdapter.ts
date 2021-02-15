import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { intersection2 } from '@jbrowse/core/util/range'
import { NoAssemblyRegion } from '@jbrowse/core/util/types'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import SimpleFeature, { Feature } from '@jbrowse/core/util/simpleFeature'
import apolloUrl from '../apolloUrl'

type ApolloFeature = any

interface SequencesResponse {
  sequences: {
    id: number
    name: string
    length: number
    start: number
    end: number
  }[]
}

export default class ApolloAdapter extends BaseFeatureDataAdapter {
  private refNames: string[] = []

  public async getRefNames(opts: BaseOptions = {}): Promise<string[]> {
    const { username, password, assemblyName } = opts
    if (!(username && password)) {
      throw new Error('Please log in to Apollo')
    }
    if (this.refNames.length) {
      return this.refNames
    }
    const data = {
      organism: assemblyName,
      username,
      password,
    }
    try {
      const response = await fetch(
        `${apolloUrl}/organism/getSequencesForOrganism`,
        {
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
          body: JSON.stringify(data),
        },
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

  public getFeatures(query: NoAssemblyRegion, opts: BaseOptions = {}) {
    const { username, password, assemblyName } = opts
    return ObservableCreate<Feature>(async observer => {
      const data = {
        organism: assemblyName,
        sequence: query.refName,
        username,
        password,
      }
      try {
        const response = await fetch(
          `${apolloUrl}/annotationEditor/getFeatures`,
          {
            headers: { 'Content-Type': 'application/json' },
            method: 'POST',
            body: JSON.stringify(data),
            signal: opts.signal,
          },
        )
        if (response.ok) {
          const result = await response.json()
          const features = result.features.filter(
            (feature: any) =>
              intersection2(
                query.start,
                query.end,
                feature.location.fmin,
                feature.location.fmax,
              ).length,
          )
          features.forEach((f: ApolloFeature) => {
            observer.next(this.apolloFeatureToFeature(f))
          })
          observer.complete()
        } else {
          observer.error(response.statusText)
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
