import { readConfObject } from '@jbrowse/core/configuration'
import {
  BaseAdapter,
  BaseArgs,
  BaseTextSearchAdapter,
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
    return readConfObject(this.config, 'trackId').uri
  }

  get internetAccountPreAuthorization():
    | { authInfo: { token: string }; internetAccountType: string }
    | undefined {
    return readConfObject(this.config, 'baseURL')
      .internetAccountPreAuthorization
  }

  async fetchFeatureByAttr(attrType: string, attr: string) {
    const url = new URL(`features/${attrType}/${attr}`, this.baseURL)
    const uri = url.toString()
    const location: UriLocation = { locationType: 'UriLocation', uri }
    if (this.internetAccountPreAuthorization) {
      location.internetAccountPreAuthorization =
        this.internetAccountPreAuthorization
    }
    const fetch = getFetcher(location, this.pluginManager)
    return fetch(uri)
      .then((res) => res.json())
      .catch((err) => err)
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
          displayString: query,
          trackId: this.trackId,
          locString: `${feature.refSeq?.name}:${feature.start}..${feature.end}`,
        }),
    )
  }

  searchIndex(args: BaseArgs): Promise<BaseResult[]> {
    const query = args.queryString
    const isId = query.startsWith('id:')
    // portion of query after first occurance of ':'
    const id = isId ? query.slice(query.indexOf(':') + 1) : null

    if (isId && id) {
      return this.fetchFeatureByAttr('id', id)
        .then((features) => this.mapBaseResult(features, query))
        .catch((err) => err)
    }

    return this.fetchFeatureByAttr('name', query)
      .then((features) => this.mapBaseResult(features, query))
      .catch((err) => err)
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  freeResources() {}
}
