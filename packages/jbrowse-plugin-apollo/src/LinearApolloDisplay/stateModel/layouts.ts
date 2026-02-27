/* eslint-disable @typescript-eslint/no-unnecessary-condition */

import type { AnnotationFeature } from '@apollo-annotation/mst'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import { type AbstractSessionModel, doesIntersect2 } from '@jbrowse/core/util'
import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import { autorun, observable } from 'mobx'

import type { ApolloSessionModel } from '../../session'
import {
  isCDSFeature,
  isExonFeature,
  isGeneFeature,
  isTranscriptFeature,
} from '../../util/glyphUtils'
import { boxGlyph } from '../glyphs/BoxGlyph'
import { cdsGlyph } from '../glyphs/CDSGlyph'
import { exonGlyph } from '../glyphs/ExonGlyph'
import { geneGlyph } from '../glyphs/GeneGlyph'
import { genericChildGlyph } from '../glyphs/GenericChildGlyph'
import type { Layout } from '../glyphs/Glyph'
import { transcriptGlyph } from '../glyphs/TranscriptGlyph'

import { baseModelFactory } from './base'

export function layoutsModelFactory(
  pluginManager: PluginManager,
  configSchema: AnyConfigurationSchemaType,
) {
  const BaseLinearApolloDisplay = baseModelFactory(pluginManager, configSchema)

  return BaseLinearApolloDisplay.named('LinearApolloDisplayLayouts')
    .props({
      cleanupBoundary: 200_000,
    })
    .volatile(() => ({
      seenFeatures: observable.map<string, AnnotationFeature>(),
    }))
    .views((self) => ({
      getAnnotationFeatureById(id: string) {
        return self.seenFeatures.get(id)
      },
      getGlyph(feature: AnnotationFeature) {
        if (isGeneFeature(feature, self.session)) {
          return geneGlyph
        }
        if (isTranscriptFeature(feature, self.session)) {
          return transcriptGlyph
        }
        if (isExonFeature(feature, self.session)) {
          return exonGlyph
        }
        if (isCDSFeature(feature, self.session)) {
          return cdsGlyph
        }
        if (feature.children?.size) {
          return genericChildGlyph
        }
        return boxGlyph
      },
    }))
    .actions((self) => ({
      addSeenFeature(feature: AnnotationFeature) {
        self.seenFeatures.set(feature._id, feature)
      },
      deleteSeenFeature(featureId: string) {
        self.seenFeatures.delete(featureId)
      },
    }))
    .views((self) => ({
      getCanonicalRefName(assemblyName: string, refSeq: string) {
        const { assemblyManager } =
          self.session as unknown as AbstractSessionModel
        const assembly = assemblyManager.get(assemblyName)
        if (!assembly) {
          throw new Error('no assembly in layout')
        }
        const canonicalRefName = assembly.getCanonicalRefName(refSeq)
        if (!canonicalRefName) {
          throw new Error('no canonical refName in layout')
        }
        return canonicalRefName
      },
    }))
    .views((self) => ({
      /**
       * Is a feature in one of the currently displayed regions and also is not
       * currently filtered out by the display.
       */
      isFeatureDisplayed(feature: AnnotationFeature) {
        const canonicalRefName = self.getCanonicalRefName(
          feature.assemblyId,
          feature.refSeq,
        )
        return self.lgv.displayedRegions.some((region) => {
          const { end, refName, start } = region
          const hasDisplayedFeatureTypes = self.filteredFeatureTypes.length > 0
          if (
            (!hasDisplayedFeatureTypes ||
              self.filteredFeatureTypes.includes(feature.type)) &&
            canonicalRefName === refName &&
            doesIntersect2(start, end, feature.min, feature.max)
          ) {
            return true
          }
          return false
        })
      },
    }))
    .views((self) => ({
      get layouts(): Map<string, Map<string, Layout>> {
        // Each refName in an assembly gets its own layout so that if a feature
        // is drawn in multiple displayed regions, it has the same layout for
        // each of them
        const layoutByAssemblyAndRefName = new Map<
          string,
          Map<string, Layout>
        >()
        // Go through all the features we know about and add them to th
        for (const [id, feature] of self.seenFeatures.entries()) {
          if (!isAlive(feature)) {
            self.deleteSeenFeature(id)
            continue
          }
          const isDisplayed = self.isFeatureDisplayed(feature)
          if (!isDisplayed) {
            continue
          }
          // This contains layout information for all the feature's sub-features
          // as well
          const featureLayout = self
            .getGlyph(feature)
            // @ts-expect-error ts doesn't understand mst extension
            .getLayout(self, feature)
          const canonicalRefName = self.getCanonicalRefName(
            feature.assemblyId,
            feature.refSeq,
          )
          let layoutForAssembly = layoutByAssemblyAndRefName.get(
            feature.assemblyId,
          )
          if (!layoutForAssembly) {
            layoutForAssembly = new Map<string, Layout>()
            layoutByAssemblyAndRefName.set(
              feature.assemblyId,
              layoutForAssembly,
            )
          }
          const layout = layoutForAssembly.get(canonicalRefName)
          if (!layout) {
            // If this refSeq doesn't have a layout yet, use this feature's
            // layout as a starting layout and move on to the next feature
            layoutForAssembly.set(canonicalRefName, featureLayout)
            continue
          }
          // Check this feature for collisions in the layout, and increase the
          // starting row if needed until there are no collisions. Then place
          // the feature in the layout.
          let startingRowIndex = 0
          placeFeature: while (true) {
            let layoutRow = layout.byRow.at(startingRowIndex)
            if (!layoutRow) {
              // We've increased startingRowIndex to a row that doesn't exist in
              // layout yet. Create new row(s), place the feature in them, and
              // move on to the next feature
              layout.byRow.push(...featureLayout.byRow)
              for (const entry of featureLayout.byFeature.entries()) {
                const [featureId, rowNumber] = entry
                layout.byFeature.set(featureId, rowNumber + startingRowIndex)
              }
              layout.min = Math.min(layout.min, featureLayout.min)
              layout.max = Math.max(layout.max, featureLayout.max)
              break placeFeature
            }
            // Check this row for collisions. Also check higher rows for
            // collisions if the feature layout takes up more than one row.
            // If there is a collision, set the startingRowIndex to the next
            // row.
            const highestRow = startingRowIndex + featureLayout.byRow.length - 1
            let currentRow = startingRowIndex
            while (layoutRow && startingRowIndex <= highestRow) {
              for (const layoutFeature of layoutRow.values()) {
                if (
                  doesIntersect2(
                    featureLayout.min,
                    featureLayout.max,
                    layoutFeature.feature.min,
                    layoutFeature.feature.max,
                  )
                ) {
                  startingRowIndex += 1
                  continue placeFeature
                }
              }
              currentRow += 1
              layoutRow = layout.byRow.at(currentRow)
            }
            // Now we have our startingRowIndex. Place feature in the layout,
            // adding new rows if necessary.
            for (let i = 0; i < featureLayout.byRow.length; i++) {
              const layoutRow = layout.byRow.at(startingRowIndex + i)
              if (layoutRow) {
                layoutRow.push(...featureLayout.byRow[i])
              } else {
                layout.byRow.push(featureLayout.byRow[i])
              }
            }
            for (const entry of featureLayout.byFeature.entries()) {
              const [featureId, rowNumber] = entry
              layout.byFeature.set(featureId, rowNumber + startingRowIndex)
            }
            layout.min = Math.min(layout.min, featureLayout.min)
            layout.max = Math.max(layout.max, featureLayout.max)
            break placeFeature
          }
        }
        return layoutByAssemblyAndRefName
      },
      getRowForFeature(feature: AnnotationFeature) {
        const canonicalRefName = self.getCanonicalRefName(
          feature.assemblyId,
          feature.refSeq,
        )
        return this.layouts
          .get(feature.assemblyId)
          ?.get(canonicalRefName)
          ?.byFeature.get(feature._id)
      },
      getFeaturesAtPosition(
        assemblyName: string,
        refName: string,
        row: number,
        bp: number,
      ): AnnotationFeature[] {
        const assemblyLayouts = this.layouts.get(assemblyName)
        if (!assemblyLayouts) {
          return []
        }
        const layout = assemblyLayouts.get(refName)
        if (!layout) {
          return []
        }
        const layoutRow = layout.byRow.at(row)
        if (!layoutRow) {
          return []
        }
        return layoutRow
          .filter(({ feature }) => {
            return bp >= feature.min && bp <= feature.max
          })
          .map((row) => row.feature)
      },
    }))
    .views((self) => ({
      highestRow(assemblyName: string) {
        const assemblyLayouts = self.layouts.get(assemblyName)
        if (!assemblyLayouts) {
          return 0
        }
        return Math.max(
          0,
          ...[...assemblyLayouts.values()].map((layout) => layout.byRow.length),
        )
      },
    }))
    .actions((self) => ({
      afterAttach() {
        addDisposer(
          self,
          autorun(
            () => {
              if (!self.lgv.initialized || self.regionCannotBeRendered()) {
                return
              }
              // Clear out features that are no longer in the view and out of the cleanup boundary
              // cleanup boundary + region boundary + cleanup boundary
              for (const [id, feature] of self.seenFeatures.entries()) {
                let shouldKeep = false
                for (const region of self.regions) {
                  const extendedStart = region.start - self.cleanupBoundary
                  const extendedEnd = region.end + self.cleanupBoundary
                  if (
                    doesIntersect2(
                      extendedStart,
                      extendedEnd,
                      feature.min,
                      feature.max,
                    )
                  ) {
                    shouldKeep = true
                    break
                  }
                }
                if (!shouldKeep) {
                  self.deleteSeenFeature(id)
                }
              }
              // Add features that are in the current view
              for (const region of self.regions) {
                const assembly = (
                  self.session as unknown as ApolloSessionModel
                ).apolloDataStore.assemblies.get(region.assemblyName)
                const ref = assembly?.getByRefName(region.refName)
                const features = ref?.features
                if (!features) {
                  continue
                }
                for (const [, feature] of features) {
                  if (
                    doesIntersect2(
                      region.start,
                      region.end,
                      feature.min,
                      feature.max,
                    ) &&
                    !self.seenFeatures.has(feature._id)
                  ) {
                    self.addSeenFeature(feature)
                  }
                }
              }
            },
            { name: 'LinearApolloDisplaySetSeenFeatures', delay: 1000 },
          ),
        )
      },
    }))
}
