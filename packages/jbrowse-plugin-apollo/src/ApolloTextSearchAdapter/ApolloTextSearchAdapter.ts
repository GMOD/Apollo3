import type { AnnotationFeatureSnapshot } from '@apollo-annotation/mst'
import BaseResult, {
  type BaseResultArgs,
} from '@jbrowse/core/TextSearch/BaseResults'
import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import { readConfObject } from '@jbrowse/core/configuration'
import {
  BaseAdapter,
  type BaseTextSearchAdapter,
  type BaseTextSearchArgs,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import type { AbstractSessionModel, UriLocation } from '@jbrowse/core/util'

import type { ApolloSessionModel } from '../session'
import { getApolloAssemblyId } from '../util'

interface ApolloResultArgs extends BaseResultArgs {
  matchedFeature: AnnotationFeatureSnapshot
}

export class ApolloSearchResult extends BaseResult {
  matchedFeature: AnnotationFeatureSnapshot

  constructor(args: ApolloResultArgs) {
    super(args)
    this.matchedFeature = args.matchedFeature
  }
}

function getMatchedFeature(
  query: string,
  feature: AnnotationFeatureSnapshot,
): AnnotationFeatureSnapshot | undefined {
  // @ts-expect-error this actually has a bit more info that a plain snapshot
  const { children, indexedIds, allIds, ...featureWithoutChildren } = feature
  const featureString = JSON.stringify(featureWithoutChildren)
  if (featureString.includes(query)) {
    return feature
  }
  if (!children) {
    return undefined
  }
  for (const subFeature of Object.values(children)) {
    const matchedFeature = getMatchedFeature(query, subFeature)
    if (matchedFeature) {
      return matchedFeature
    }
  }
}

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
    refSeqIdToName: Map<string, string>,
  ) {
    return features.map((feature) => {
      const matchedFeature = getMatchedFeature(query, feature) ?? feature
      const refName =
        refSeqIdToName.get(feature.refSeq) ??
        assembly.getCanonicalRefName(feature.refSeq)
      return new ApolloSearchResult({
        label: query,
        trackId: this.trackId,
        locString: `${refName}:${matchedFeature.min + 1}..${matchedFeature.max}`,
        matchedFeature,
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
      const apolloAssemblyId = getApolloAssemblyId(assembly)
      const [features, refNameAliases] = await Promise.all([
        backendDriver.searchFeatures(args.queryString, [apolloAssemblyId]),
        backendDriver.getRefNameAliases(assemblyName),
      ])
      // Search results carry each feature's internal refSeq id (not its
      // display refName), so resolve it via the same id -> refName mapping
      // the backend driver already exposes for other lookups.
      const refSeqIdToName = new Map<string, string>()
      for (const { aliases, refName } of refNameAliases) {
        for (const alias of aliases) {
          refSeqIdToName.set(alias, refName)
        }
      }
      results.push(
        ...this.mapBaseResult(features, assembly, query, refSeqIdToName),
      )
    }

    return results
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  freeResources() {}
}
