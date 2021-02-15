import {
  // BaseAdapter,
  BaseFeatureDataAdapter,
  BaseOptions,
  RegionsAdapter,
} from '@jbrowse/core/data_adapters/BaseAdapter'
// import honeybeeResponse from './test_data/honeybeeGroup1.10.json'
import { readConfObject } from '@jbrowse/core/configuration'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import SimpleFeature, { Feature } from '@jbrowse/core/util/simpleFeature'
import { Instance } from 'mobx-state-tree'
import ConfigSchema from './configSchema'
import { NoAssemblyRegion } from '@jbrowse/core/util'
import apolloUrl from '../apolloUrl'

interface SequencesResponse {
  error?: string
  sequences: {
    id: number
    name: string
    length: number
    start: number
    end: number
  }[]
}
export default class ApolloSequenceAdapter extends BaseFeatureDataAdapter
  implements RegionsAdapter {
  private organismName: string

  private refSeqs: Map<string, number> | undefined = undefined

  public constructor(config: Instance<typeof ConfigSchema>) {
    super(config)
    const organismName = readConfObject(config, 'organismName')
    this.organismName = organismName
  }

  private async getRefSeqs(opts: BaseOptions) {
    if (this.refSeqs) {
      return this.refSeqs
    }
    const data = {
      organism: this.organismName,
      username: opts.username,
      password: opts.password,
    }
    const response = await fetch(
      `${apolloUrl}/organism/getSequencesForOrganism`,
      {
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
        body: JSON.stringify(data),
      },
    )
    if (!response.ok) {
      throw new Error(response.statusText)
    }
    const result = (await response.json()) as SequencesResponse
    if (result.error) {
      console.trace(result, data)
      throw new Error(result.error)
    }
    const refSeqs = new Map()
    result.sequences.forEach(seq => {
      refSeqs.set(seq.name, seq.length)
    })
    this.refSeqs = refSeqs
    return refSeqs
  }

  public async getRegions(opts: BaseOptions) {
    const refSeqs = await this.getRefSeqs(opts)
    return Array.from(refSeqs.entries()).map(([refName, length]) => ({
      refName,
      start: 0,
      end: length,
    }))
  }

  public getFeatures(query: NoAssemblyRegion, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      // const data = {
      //   organismString: this.organismName,
      //   sequenceName: query.refName,
      //   fmin: query.start,
      //   fmax: query.end,
      //   username: opts.username,
      //   password: opts.password,
      // }
      try {
        const response = await fetch(
          `${apolloUrl}/sequence/${this.organismName}/${query.refName}:${query.start}..${query.end}`,
          { signal: opts.signal },
        )
        if (response.ok) {
          const seq = await response.text()
          observer.next(
            new SimpleFeature({
              uniqueId: `${query.refName}:${query.start}..${query.end}`,
              seq,
              end: query.end,
              start: query.start,
            }),
          )
          observer.complete()
        } else {
          observer.error(response.statusText)
        }
      } catch (error) {
        observer.error(error)
      }
    })
  }

  public async getRefNames(opts: BaseOptions) {
    return Array.from((await this.getRefSeqs(opts)).keys())
  }

  public freeResources(/* { region } */): void {}
}
