import { readConfObject } from '@jbrowse/core/configuration'
import {
  BaseOptions,
  BaseSequenceAdapter,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { getFetcher } from '@jbrowse/core/util/io'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import SimpleFeature, { Feature } from '@jbrowse/core/util/simpleFeature'
import { NoAssemblyRegion } from '@jbrowse/core/util/types'

export interface RefSeq {
  _id: string
  name: string
  description: string
  length: number
}

export class ApolloSequenceAdapter extends BaseSequenceAdapter {
  private refSeqs: Promise<RefSeq[]> | undefined

  get baseURL() {
    return readConfObject(this.config, 'baseURL')
  }

  protected async getRefSeqs({ signal }: BaseOptions) {
    if (this.refSeqs) {
      return this.refSeqs
    }
    const assemblyId = readConfObject(this.config, 'assemblyId')
    const url = new URL('refSeqs', this.baseURL)
    const searchParams = new URLSearchParams({ assembly: assemblyId })
    url.search = searchParams.toString()
    const uri = url.toString()
    const fetch = getFetcher(
      { locationType: 'UriLocation', uri },
      this.pluginManager,
    )
    const response = await fetch(uri, { signal })
    if (!response.ok) {
      let errorMessage
      try {
        errorMessage = await response.text()
      } catch (e) {
        errorMessage = ''
      }
      throw new Error(
        `Failed to fetch refSeqs — ${response.status} (${response.statusText})${
          errorMessage ? ` (${errorMessage})` : ''
        }`,
      )
    }
    const refSeqs = (await response.json()) as RefSeq[]
    this.refSeqs = Promise.resolve(refSeqs)
    return refSeqs
  }

  public async getRefNames(opts: BaseOptions) {
    const refSeqs = await this.getRefSeqs(opts)
    return refSeqs.map((refSeq) => refSeq.name)
  }

  public async getRegions(opts: BaseOptions): Promise<NoAssemblyRegion[]> {
    const refSeqs = await this.getRefSeqs(opts)
    return refSeqs.map((refSeq) => ({
      refName: refSeq.name,
      start: 0,
      end: refSeq.length,
    }))
  }

  /**
   * Fetch features for a certain region
   * @param param -
   * @returns Observable of Feature objects in the region
   */
  public getFeatures(
    { refName, start, end }: NoAssemblyRegion,
    opts: BaseOptions,
  ) {
    return ObservableCreate<Feature>(async (observer) => {
      const refSeqs = await this.getRefSeqs(opts)
      const refSeq = refSeqs.find((rs) => rs.name === refName)
      if (!refSeq) {
        return observer.error(
          `Could not find refSeq that matched refName "${refName}"`,
        )
      }
      const url = new URL('refSeqs/getSequence', this.baseURL)
      const searchParams = new URLSearchParams({
        refSeq: refSeq._id,
        start: String(start),
        end: String(end),
      })
      url.search = searchParams.toString()
      const uri = url.toString()
      const fetch = getFetcher(
        { locationType: 'UriLocation', uri },
        this.pluginManager,
      )
      const response = await fetch(uri, { signal: opts.signal })
      if (!response.ok) {
        let errorMessage
        try {
          errorMessage = await response.text()
        } catch (e) {
          errorMessage = ''
        }
        throw new Error(
          `Failed to fetch refSeqs — ${response.status} (${
            response.statusText
          })${errorMessage ? ` (${errorMessage})` : ''}`,
        )
      }
      const seq = (await response.text()) as string
      if (seq) {
        observer.next(
          new SimpleFeature({
            id: `${refName} ${start}-${end}`,
            data: { refName, start, end, seq },
          }),
        )
      }
      observer.complete()
    })
  }

  /**
   * called to provide a hint that data tied to a certain region
   * will not be needed for the forseeable future and can be purged
   * from caches, etc
   */
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  public freeResources(/* { region } */): void {}
}
