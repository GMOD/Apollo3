import { readConfObject } from '@jbrowse/core/configuration'
import {
  BaseAdapter,
  BaseTextSearchAdapter,
  BaseTextSearchArgs,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import BaseResult from '@jbrowse/core/TextSearch/BaseResults'
import { UriLocation } from '@jbrowse/core/util'
import { getFetcher } from '@jbrowse/core/util/io'

export class ApolloTextSearchAdapter
  extends BaseAdapter
  implements BaseTextSearchAdapter
{
  get baseURL() {
    return readConfObject(this.config, 'baseURL').uri
  }

  get trackId() {
    return readConfObject(this.config, 'trackId')
  }

  get assemblyNames() {
    return readConfObject(this.config, 'assemblyNames')
  }

  async searchFeatures(term: string) {
    const assemblies = this.assemblyNames.join(',')
    const url = new URL('features/searchFeatures', this.baseURL)
    const searchParams = new URLSearchParams({ assemblies, term })
    url.search = searchParams.toString()
    const uri = url.toString()

    const location: UriLocation = { locationType: 'UriLocation', uri }
    const fetch = getFetcher(location, this.pluginManager)
    const response = await fetch(uri)
    return response.json()
  }

  mapBaseResult(
    features: {
      refSeq: any // eslint-disable-line @typescript-eslint/no-explicit-any
      start: number
      end: number
    }[],
    query: string,
  ) {
    return features.map(
      (feature) =>
        new BaseResult({
          label: query,
          trackId: this.trackId,
          locString: `${feature.refSeq?.name}:${feature.start}..${feature.end}`,
        }),
    )
  }

  async searchIndex(args: BaseTextSearchArgs): Promise<BaseResult[]> {
    const query = args.queryString
    const features = await this.searchFeatures(query)
    return this.mapBaseResult(features, query)
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  freeResources() {}
}
