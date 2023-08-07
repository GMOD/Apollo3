import { readConfObject } from '@jbrowse/core/configuration'
import {
  BaseAdapter,
  BaseTextSearchAdapter,
  BaseTextSearchArgs,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import BaseResult from '@jbrowse/core/TextSearch/BaseResults'
import { getSession, UriLocation } from '@jbrowse/core/util'
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

  async searchFeatures(searchDto: { term: string; assemblies: string }) {
    const { term, assemblies } = searchDto
    const results = []
    for (const assemblyName of this.assemblyNames) {
      const session = getSession(self)
      const backendDriver =
        session.apolloDataStore.getBackendDriver(assemblyName)
      // const backendDriver = this.pluginManager.rootModel.session.apolloDataStore.getBackendDriver(
      //     assemblyName,
      //  )
      const r = await backendDriver.searchFeatures(term, assemblies)
      results.push(...r)
    }
    return results
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
