import { readConfObject } from '@jbrowse/core/configuration'
import {
  BaseAdapter,
  BaseTextSearchAdapter,
  BaseTextSearchArgs,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import BaseResult from '@jbrowse/core/TextSearch/BaseResults'

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
          locString: `${feature.refSeq?.name}:${feature.start + 1}..${
            feature.end
          }`,
        }),
    )
  }

  async searchIndex(args: BaseTextSearchArgs): Promise<BaseResult[]> {
    const results = []
    for (const assemblyName of this.assemblyNames) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const session = this.pluginManager?.rootModel?.session as any
      const backendDriver =
        session?.apolloDataStore.getBackendDriver(assemblyName)
      const r = await backendDriver.searchFeatures(args.queryString, [
        assemblyName,
      ])
      results.push(...r)
    }

    const query = args.queryString
    return this.mapBaseResult(results, query)
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  freeResources() {}
}
