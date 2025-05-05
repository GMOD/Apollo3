import { type AnnotationFeatureSnapshot } from '@apollo-annotation/mst'
import BaseResult from '@jbrowse/core/TextSearch/BaseResults'
import { type Assembly } from '@jbrowse/core/assemblyManager/assembly'
import { readConfObject } from '@jbrowse/core/configuration'
import {
  BaseAdapter,
  type BaseTextSearchAdapter,
  type BaseTextSearchArgs,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { type AbstractSessionModel, type UriLocation } from '@jbrowse/core/util'

import { type ApolloSessionModel } from '../session'

export class ApolloTextSearchAdapter
  extends BaseAdapter
  implements BaseTextSearchAdapter
{
  get baseURL() {
    return (readConfObject(this.config, 'baseURL') as UriLocation).uri
  }

  get trackId() {
    return readConfObject(this.config, 'trackId') as string
  }

  get assemblyNames() {
    return readConfObject(this.config, 'assemblyNames') as string[]
  }

  mapBaseResult(
    features: AnnotationFeatureSnapshot[],
    assembly: Assembly,
    query: string,
  ) {
    return features.map((feature) => {
      const refName = assembly.getCanonicalRefName(feature.refSeq)
      return new BaseResult({
        label: query,
        trackId: this.trackId,
        locString: `${refName}:${feature.min + 1}..${feature.max}`,
      })
    })
  }

  async searchIndex(args: BaseTextSearchArgs): Promise<BaseResult[]> {
    const query = args.queryString
    const results: BaseResult[] = []
    const session = this.pluginManager?.rootModel?.session as
      | ApolloSessionModel
      | undefined
    if (!session) {
      return results
    }
    const { apolloDataStore } = session
    const { assemblyManager } = session as unknown as AbstractSessionModel
    for (const assemblyName of this.assemblyNames) {
      const backendDriver = apolloDataStore.getBackendDriver(assemblyName)
      const assembly = assemblyManager.get(assemblyName)
      if (!(backendDriver && assembly)) {
        continue
      }
      const features = await backendDriver.searchFeatures(args.queryString, [
        assemblyName,
      ])
      results.push(...this.mapBaseResult(features, assembly, query))
    }

    return results
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  freeResources() {}
}
