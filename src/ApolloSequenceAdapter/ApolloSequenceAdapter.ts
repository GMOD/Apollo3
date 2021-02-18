import { readConfObject } from '@jbrowse/core/configuration'
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'
import {
  BaseFeatureDataAdapter,
  BaseOptions,
  RegionsAdapter,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { NoAssemblyRegion } from '@jbrowse/core/util'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import SimpleFeature, { Feature } from '@jbrowse/core/util/simpleFeature'
import { Instance } from 'mobx-state-tree'
import { apolloFetch } from '../apolloFetch'
import ConfigSchema from './configSchema'

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

  private apolloConfig: AnyConfigurationModel

  private refSeqs: Map<string, number> | undefined = undefined

  public constructor(config: Instance<typeof ConfigSchema>) {
    super(config)
    const organismName = readConfObject(config, 'organismName')
    this.organismName = organismName
    this.apolloConfig = config.apolloConfig
  }

  private async getRefSeqs(
    opts: BaseOptions & { username?: string; password?: string },
  ) {
    if (this.refSeqs) {
      return this.refSeqs
    }
    const { signal, username, password } = opts
    const data = { organism: this.organismName }
    const response = await apolloFetch(
      this.apolloConfig,
      'organism/getSequencesForOrganism',
      { body: JSON.stringify(data), signal: signal },
      { username, password },
    )
    if (!response.ok) {
      throw new Error(response.statusText)
    }
    const result = (await response.json()) as SequencesResponse
    if (result.error) {
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
    const { refName, start, end } = query
    const { signal, location, username, password } = opts
    return ObservableCreate<Feature>(async observer => {
      const data = { username, password }
      try {
        const response = await fetch(
          `${location}/sequence/${this.organismName}/${refName}:${start}..${end}`,
          { signal, method: 'POST', body: JSON.stringify(data) },
        )
        if (response.ok) {
          const seq = await response.text()
          observer.next(
            new SimpleFeature({
              id: `${refName}:${start}..${end}`,
              data: { seq, end, start, refName },
            }),
          )
          observer.complete()
        } else {
          observer.error(
            new Error(`${response.statusText} (${response.status})`),
          )
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
