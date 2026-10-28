import { type FeatureDensity, niceBinSize } from '@apollo-annotation/shared'
import { getConf } from '@jbrowse/core/configuration'
import {
  type Region,
  getContainingView,
  getSession,
  isContainedWithin,
} from '@jbrowse/core/util'
import { addDisposer, types } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { autorun } from 'mobx'

import type { ApolloSessionModel } from '../session'

export type ThresholdMode = 'auto' | 'fixed'

/**
 * - `features`: render features normally
 * - `density`: render a feature density histogram instead of features
 * - `pending`: waiting to find out how many features are in view
 */
export type DisplayMode = 'features' | 'density' | 'pending'

/** Width of a histogram bin, in px, before rounding the bin size in bp */
const minBinWidthPx = 3
/** Don't summarize views with more regions than this */
const maxDensityRegions = 50
/** How many sets of regions known to be under the limit to remember */
const maxUnderLimitEntries = 10

/** Configuration slots for displays that use {@link FeatureDensityMixin} */
export const featureDensityConfigSlots = {
  thresholdMode: {
    model: types.enumeration('ThresholdMode', ['auto', 'fixed']),
    type: 'stringEnum',
    defaultValue: 'auto',
    description:
      'When to show a feature density histogram instead of features. `auto` shows features when there are at most `maxFeatureCount` in view. `fixed` shows features when zoomed in to less than `zoomThreshold` bp per px.',
  },
  maxFeatureCount: {
    type: 'number',
    defaultValue: 200,
    description:
      'In `auto` mode, the most features to show before showing a feature density histogram instead',
  },
  zoomThreshold: {
    type: 'number',
    defaultValue: 200,
    description:
      'In `fixed` mode, the bp per px at or above which a feature density histogram is shown instead of features',
  },
}

export interface DensityStats {
  key: string
  regions: Region[]
  densities: FeatureDensity[]
}

export interface UnderLimitEntry {
  regions: Region[]
  count: number
}

/** The display this is mixed into provides the configuration */
function getDisplayConf(self: object, slotName: string): unknown {
  return getConf(self as Parameters<typeof getConf>[0], slotName)
}

function regionsKey(regions: Region[], binSize: number, changeCount: number) {
  return JSON.stringify([
    changeCount,
    binSize,
    regions.map(({ assemblyName, end, refName, start }) => [
      assemblyName,
      refName,
      start,
      end,
    ]),
  ])
}

/**
 * Decides whether a display renders features or a feature density histogram.
 *
 * In "auto" mode, it asks the backend how many features are in view and shows
 * features if there are at most `maxFeatureCount`. In "fixed" mode, it shows
 * features when zoomed in to less than `zoomThreshold` bp per px.
 */
export function FeatureDensityMixin() {
  return types
    .model('FeatureDensityMixin', {
      thresholdMode: types.maybe(
        types.enumeration<ThresholdMode>('ThresholdMode', ['auto', 'fixed']),
      ),
      maxFeatureCount: types.maybe(types.number),
      zoomThreshold: types.maybe(types.number),
    })
    .volatile(() => ({
      densityStats: undefined as DensityStats | undefined,
      densityError: undefined as string | undefined,
      pendingDensityKey: undefined as string | undefined,
      underLimit: [] as UnderLimitEntry[],
      forceLoadBpPerPx: undefined as number | undefined,
    }))
    .views((self) => ({
      get densityLgv() {
        return getContainingView(self) as unknown as LinearGenomeViewModel
      },
      get thresholdModeSetting(): ThresholdMode {
        return (
          self.thresholdMode ??
          (getDisplayConf(self, 'thresholdMode') as
            | ThresholdMode
            | undefined) ??
          'auto'
        )
      },
      get maxFeatureCountSetting(): number {
        return (
          self.maxFeatureCount ??
          (getDisplayConf(self, 'maxFeatureCount') as number | undefined) ??
          200
        )
      },
      get zoomThresholdSetting(): number {
        return (
          self.zoomThreshold ??
          (getDisplayConf(self, 'zoomThreshold') as number | undefined) ??
          200
        )
      },
    }))
    .views((self) => ({
      get densityRegions(): Region[] {
        return self.densityLgv.dynamicBlocks.contentBlocks.map(
          ({ assemblyName, end, refName, start }) => ({
            assemblyName,
            refName,
            start: Math.round(start),
            end: Math.round(end),
          }),
        )
      },
      get densityBinSize() {
        return niceBinSize(self.densityLgv.bpPerPx * minBinWidthPx)
      },
      get isForceLoaded() {
        const { forceLoadBpPerPx } = self
        return (
          forceLoadBpPerPx !== undefined &&
          self.densityLgv.bpPerPx <= forceLoadBpPerPx
        )
      },
    }))
    .views((self) => ({
      get densityKey() {
        const { apolloDataStore } = getSession(
          self,
        ) as unknown as ApolloSessionModel
        // Including the change count refreshes the density after edits
        return regionsKey(
          self.densityRegions,
          self.densityBinSize,
          apolloDataStore.changeCount,
        )
      },
      /**
       * Whether the regions in view are within regions already known to have
       * few enough features. If so, there's no need to check again.
       */
      get isKnownUnderLimit() {
        const regions = self.densityRegions
        return self.underLimit.some(
          (entry) =>
            entry.count <= self.maxFeatureCountSetting &&
            regions.every((region) =>
              entry.regions.some(
                (known) =>
                  known.assemblyName === region.assemblyName &&
                  known.refName === region.refName &&
                  isContainedWithin(
                    region.start,
                    region.end,
                    known.start,
                    known.end,
                  ),
              ),
            ),
        )
      },
      get hasTooManyDensityRegions() {
        return self.densityRegions.length > maxDensityRegions
      },
      /** Total number of features in view, if known */
      get featureCountInView() {
        const { densityStats } = self
        if (densityStats?.key !== this.densityKey) {
          return
        }
        let count = 0
        for (const density of densityStats.densities) {
          count += density.count
        }
        return count
      },
    }))
    .views((self) => ({
      get densityStatsNeeded() {
        if (self.isForceLoaded) {
          return false
        }
        if (self.thresholdModeSetting === 'fixed') {
          return self.densityLgv.bpPerPx >= self.zoomThresholdSetting
        }
        return !self.isKnownUnderLimit
      },
      get displayMode(): DisplayMode {
        if (self.isForceLoaded) {
          return 'features'
        }
        if (self.thresholdModeSetting === 'fixed') {
          return self.densityLgv.bpPerPx < self.zoomThresholdSetting
            ? 'features'
            : 'density'
        }
        if (self.isKnownUnderLimit) {
          return 'features'
        }
        const { densityStats } = self
        if (!densityStats) {
          return 'pending'
        }
        // While new stats load (e.g. while scrolling), keep using the previous
        // ones so the display doesn't flicker. canLoadFeatures guards against
        // loading features based on these stale stats.
        let count = 0
        for (const density of densityStats.densities) {
          count += density.count
        }
        return count <= self.maxFeatureCountSetting ? 'features' : 'density'
      },
    }))
    .views((self) => ({
      /** Whether it's safe to load the features for the regions in view */
      get canLoadFeatures() {
        if (self.displayMode !== 'features') {
          return false
        }
        if (
          self.isForceLoaded ||
          self.thresholdModeSetting === 'fixed' ||
          self.isKnownUnderLimit
        ) {
          return true
        }
        const count = self.featureCountInView
        return count !== undefined && count <= self.maxFeatureCountSetting
      },
      /** A message to show if neither features nor density can be shown */
      get densityMessage(): string | undefined {
        if (self.displayMode === 'features') {
          return
        }
        if (self.hasTooManyDensityRegions) {
          return 'Too many regions to summarize, zoom in to see annotations'
        }
        if (self.densityError) {
          return 'Could not load feature density, zoom in to see annotations'
        }
        return
      },
    }))
    .actions((self) => ({
      setDensityStats(
        key: string,
        regions: Region[],
        densities: (FeatureDensity | undefined)[],
      ) {
        if (key !== self.pendingDensityKey) {
          // A newer request has been made since this one
          return
        }
        self.pendingDensityKey = undefined
        self.densityError = undefined
        const filledDensities = densities.map(
          (density, idx) =>
            density ?? {
              count: 0,
              start: regions[idx].start,
              binSize: 1,
              bins: [],
            },
        )
        self.densityStats = { key, regions, densities: filledDensities }
        let count = 0
        for (const density of filledDensities) {
          count += density.count
        }
        if (count <= self.maxFeatureCountSetting) {
          self.underLimit = [{ regions, count }, ...self.underLimit].slice(
            0,
            maxUnderLimitEntries,
          )
        }
      },
      setDensityError(key: string, error: unknown) {
        if (key !== self.pendingDensityKey) {
          return
        }
        self.pendingDensityKey = undefined
        self.densityError =
          error instanceof Error ? error.message : String(error)
      },
      /**
       * @param key - the current `densityKey`. Passed in so the caller's
       * autorun tracks it; actions are untracked.
       */
      fetchDensityStats(key: string) {
        if (
          key === self.pendingDensityKey ||
          (key === self.densityStats?.key && !self.densityError)
        ) {
          return
        }
        self.pendingDensityKey = key
        const regions = self.densityRegions
        const binSize = self.densityBinSize
        const { apolloDataStore } = getSession(
          self,
        ) as unknown as ApolloSessionModel
        Promise.all(
          regions.map((region) =>
            apolloDataStore.getFeatureDensity(region, binSize),
          ),
        ).then(
          (densities) => {
            this.setDensityStats(key, regions, densities)
          },
          (error: unknown) => {
            console.error(error)
            this.setDensityError(key, error)
          },
        )
      },
      /** Show features in view even though there are more than the limit */
      forceLoadFeatures() {
        self.forceLoadBpPerPx = self.densityLgv.bpPerPx
      },
      setFeatureDisplayThreshold({
        maxFeatureCount,
        mode,
        zoomThreshold,
      }: {
        mode: ThresholdMode
        maxFeatureCount: number
        zoomThreshold: number
      }) {
        self.thresholdMode = mode
        self.maxFeatureCount = maxFeatureCount
        self.zoomThreshold = zoomThreshold
        self.forceLoadBpPerPx = undefined
      },
    }))
    .actions((self) => ({
      afterAttach() {
        addDisposer(
          self,
          autorun(
            () => {
              if (
                !self.densityLgv.initialized ||
                !self.densityStatsNeeded ||
                self.hasTooManyDensityRegions
              ) {
                return
              }
              self.fetchDensityStats(self.densityKey)
            },
            { name: 'FeatureDensityFetchStats', delay: 500 },
          ),
        )
      },
    }))
}
