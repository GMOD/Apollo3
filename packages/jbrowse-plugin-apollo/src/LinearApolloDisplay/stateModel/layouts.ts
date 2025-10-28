/* eslint-disable @typescript-eslint/no-unnecessary-condition */

import { type AnnotationFeature } from '@apollo-annotation/mst'
import type PluginManager from '@jbrowse/core/PluginManager'
import { type AnyConfigurationSchemaType } from '@jbrowse/core/configuration/configurationSchema'
import { type AbstractSessionModel, doesIntersect2 } from '@jbrowse/core/util'
import { autorun, observable } from 'mobx'
import { addDisposer, isAlive } from 'mobx-state-tree'
import RBush from 'rbush'

import { type ApolloSessionModel } from '../../session'
import { boxGlyph, geneGlyph, genericChildGlyph } from '../glyphs'

import { baseModelFactory } from './base'

export interface LayoutFeature {
  min: number
  max: number
  row: number
  height: number
  feature: AnnotationFeature
}

class FeatureRBush extends RBush<LayoutFeature> {
  toBBox(layoutFeature: LayoutFeature) {
    const { min, max, row, height } = layoutFeature
    return { minX: min, minY: row, maxX: max, maxY: row + height - 1 }
  }
  compareMinX(a: LayoutFeature, b: LayoutFeature) {
    return a.min - b.min
  }
  compareMinY(a: LayoutFeature, b: LayoutFeature) {
    return a.row - b.row
  }
}

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
        const { topLevelFeature } = feature
        if (topLevelFeature.looksLikeGene) {
          return geneGlyph
        }
        if (topLevelFeature.children?.size) {
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
      get featureLayouts() {
        const layoutByRefName = new Map<string, FeatureRBush>()
        const { assemblyManager } =
          self.session as unknown as AbstractSessionModel
        const { featureTypeOntology } =
          self.session.apolloDataStore.ontologyManager
        if (!featureTypeOntology) {
          throw new Error('featureTypeOntology is undefined')
        }
        for (const [id, feature] of self.seenFeatures.entries()) {
          if (!isAlive(feature)) {
            self.deleteSeenFeature(id)
            continue
          }
          const assembly = assemblyManager.get(feature.assemblyId)
          if (!assembly) {
            throw new Error('no assembly in layout')
          }
          const canonicalRefName = assembly.getCanonicalRefName(feature.refSeq)
          if (!canonicalRefName) {
            throw new Error('no canonical refName in layout')
          }
          const isDisplayed = self.lgv.displayedRegions.some((region) => {
            const { end, refName, start } = region
            const hasDisplayedFeatureTypes =
              self.displayedFeatureTypes.length > 0
            if (
              (!hasDisplayedFeatureTypes ||
                self.displayedFeatureTypes.includes(feature.type)) &&
              canonicalRefName === refName &&
              doesIntersect2(start, end, feature.min, feature.max)
            ) {
              return true
            }
            return false
          })
          if (!isDisplayed) {
            continue
          }
          const rowCount = self
            .getGlyph(feature)
            .getRowCount(feature, featureTypeOntology, self.lgv.bpPerPx)
          const tree = layoutByRefName.get(canonicalRefName)
          if (!tree) {
            const newTree = new FeatureRBush()
            newTree.insert({
              min: feature.min,
              max: feature.max,
              row: 0,
              height: rowCount,
              feature,
            })
            layoutByRefName.set(canonicalRefName, newTree)
            continue
          }
          let startingRowIndex = 0
          while (
            tree.collides({
              minX: feature.min,
              maxX: feature.max,
              minY: startingRowIndex,
              maxY: startingRowIndex + rowCount - 1,
            })
          ) {
            startingRowIndex += 1
          }
          tree.insert({
            min: feature.min,
            max: feature.max,
            row: startingRowIndex,
            height: rowCount,
            feature,
          })
        }
        return layoutByRefName
      },
      getFeatureLayoutPosition(feature: AnnotationFeature) {
        const { featureLayouts } = this
        const { featureTypeOntology } =
          self.session.apolloDataStore.ontologyManager
        if (!featureTypeOntology) {
          throw new Error('featureTypeOntology is undefined')
        }
        const { assemblyManager } =
          self.session as unknown as AbstractSessionModel
        const assembly = assemblyManager.get(feature.assemblyId)
        if (!assembly) {
          throw new Error('no assembly in layoutPosition')
        }
        const canonicalRefName = assembly.getCanonicalRefName(feature.refSeq)
        if (!canonicalRefName) {
          throw new Error('no canonicalRefName in layoutPosition')
        }
        const tree = featureLayouts.get(canonicalRefName)
        if (!tree) {
          return
        }
        const { topLevelFeature } = feature
        for (const layoutFeature of tree.all()) {
          if (layoutFeature.feature._id === topLevelFeature._id) {
            if (feature._id === topLevelFeature._id) {
              return {
                layoutRowIndex: layoutFeature.row,
                featureRowIndex: layoutFeature.row,
              }
            }
            const featureRow = self
              .getGlyph(topLevelFeature)
              .getRowForFeature(topLevelFeature, feature, featureTypeOntology)
            if (featureRow === undefined) {
              return
            }
            return {
              layoutRowIndex: layoutFeature.row,
              featureRowIndex: layoutFeature.row + featureRow,
            }
          }
        }
        return
      },
    }))
    .views((self) => ({
      get highestRow() {
        const { featureLayouts } = self
        const highestForEachRefName = [...featureLayouts.values()].map(
          (tree) => {
            const data = tree.toJSON() as { height: number }
            return data.height
          },
        )
        return Math.max(0, ...highestForEachRefName) + 1
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
