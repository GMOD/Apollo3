/* eslint-disable @typescript-eslint/no-unnecessary-condition */

import { AnnotationFeature, TranscriptPartCoding } from '@apollo-annotation/mst'
import { AnyConfigurationSchemaType } from '@jbrowse/core/configuration/configurationSchema'
import PluginManager from '@jbrowse/core/PluginManager'
import {
  AbstractSessionModel,
  doesIntersect2,
  getFrame,
} from '@jbrowse/core/util'
import { autorun, observable } from 'mobx'
import { addDisposer, isAlive } from 'mobx-state-tree'

import { ApolloSessionModel } from '../../session'
import { baseModelFactory } from './base'
import { geneGlyph } from '../glyphs'

export function layoutsModelFactory(
  pluginManager: PluginManager,
  configSchema: AnyConfigurationSchemaType,
) {
  const BaseLinearApolloSixFrameDisplay = baseModelFactory(
    pluginManager,
    configSchema,
  )

  return BaseLinearApolloSixFrameDisplay.named(
    'LinearApolloSixFrameDisplayLayouts',
  )
    .props({
      featuresMinMaxLimit: 500_000,
    })
    .volatile(() => ({
      seenFeatures: observable.map<string, AnnotationFeature>(),
    }))
    .views((self) => ({
      get featuresMinMax() {
        const { assemblyManager } =
          self.session as unknown as AbstractSessionModel
        return self.lgv.displayedRegions.map((region) => {
          const assembly = assemblyManager.get(region.assemblyName)
          let min: number | undefined
          let max: number | undefined
          const { end, refName, start } = region
          for (const [, feature] of self.seenFeatures) {
            if (
              refName !== assembly?.getCanonicalRefName(feature.refSeq) ||
              !doesIntersect2(start, end, feature.min, feature.max) ||
              feature.length > self.featuresMinMaxLimit
            ) {
              continue
            }
            if (min === undefined) {
              ;({ min } = feature)
            }
            if (max === undefined) {
              ;({ max } = feature)
            }
            if (feature.minWithChildren < min) {
              ;({ min } = feature)
            }
            if (feature.maxWithChildren > max) {
              ;({ max } = feature)
            }
          }
          if (min !== undefined && max !== undefined) {
            return [min, max]
          }
          return
        })
      },
      getGlyph(_feature: AnnotationFeature) {
        return geneGlyph
      },
      looksLikeGene(feature: AnnotationFeature): boolean {
        const { featureTypeOntology } =
          self.session.apolloDataStore.ontologyManager
        if (!featureTypeOntology) {
          return false
        }
        const { children } = feature
        if (!children?.size) {
          return false
        }
        const isGene = featureTypeOntology.isTypeOf(feature.type, 'gene')
        if (!isGene) {
          return false
        }
        for (const [, child] of children) {
          if (featureTypeOntology.isTypeOf(child.type, 'transcript')) {
            const { children: grandChildren } = child
            if (!grandChildren?.size) {
              return false
            }
            const hasCDS = [...grandChildren.values()].some((grandchild) =>
              featureTypeOntology.isTypeOf(grandchild.type, 'CDS'),
            )
            const hasExon = [...grandChildren.values()].some((grandchild) =>
              featureTypeOntology.isTypeOf(grandchild.type, 'exon'),
            )
            if (hasCDS && hasExon) {
              return true
            }
          }
        }
        return false
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
        const { assemblyManager } =
          self.session as unknown as AbstractSessionModel
        return self.lgv.displayedRegions.map((region, idx) => {
          const assembly = assemblyManager.get(region.assemblyName)
          const featureLayout = new Map<
            number,
            [
              number,
              AnnotationFeature,
              AnnotationFeature,
              TranscriptPartCoding,
            ][]
          >()
          const minMax = self.featuresMinMax[idx]
          if (!minMax) {
            return featureLayout
          }
          const { end, refName, start } = region
          for (const [id, feature] of self.seenFeatures.entries()) {
            if (!isAlive(feature)) {
              self.deleteSeenFeature(id)
              continue
            }
            if (!self.looksLikeGene(feature)) {
              continue
            }
            if (
              refName !== assembly?.getCanonicalRefName(feature.refSeq) ||
              !doesIntersect2(start, end, feature.min, feature.max)
            ) {
              continue
            }
            const { featureTypeOntology } =
              self.session.apolloDataStore.ontologyManager
            if (!featureTypeOntology) {
              throw new Error('featureTypeOntology is undefined')
            }
            const { children } = feature
            if (!children) {
              continue
            }
            for (const [, child] of children) {
              if (featureTypeOntology.isTypeOf(child.type, 'transcript')) {
                const { cdsLocations, strand } = child
                for (const cdsRow of cdsLocations) {
                  for (const cds of cdsRow) {
                    const rowNum = getFrame(
                      cds.min,
                      cds.max,
                      strand ?? 1,
                      cds.phase,
                    )
                    if (!featureLayout.get(rowNum)) {
                      featureLayout.set(rowNum, [])
                    }
                    const layoutRow = featureLayout.get(rowNum)
                    layoutRow?.push([rowNum, feature, child, cds])
                  }
                }
              }
            }
          }
          return featureLayout
        })
      },
      // TODO: Fix this
      getFeatureLayoutPosition(_feature: AnnotationFeature) {
        const { featureLayouts } = this
        const { featureTypeOntology } =
          self.session.apolloDataStore.ontologyManager
        for (const [idx, layout] of featureLayouts.entries()) {
          for (const [layoutRowNum, layoutRow] of layout) {
            for (const [featureRowNum, layoutFeature] of layoutRow) {
              if (featureRowNum !== 0) {
                // Same top-level feature in all feature rows, so only need to
                // check the first one
                continue
              }
              // if (feature._id === layoutFeature._id) {
              return {
                layoutIndex: idx,
                layoutRow: layoutRowNum,
                featureRow: featureRowNum,
              }
              // }
              // if (layoutFeature.hasDescendant(feature._id)) {
              //   const row = self
              //     .getGlyph(layoutFeature)
              //     .getRowForFeature(layoutFeature, feature)
              //   if (row !== undefined) {
              //     return {
              //       layoutIndex: idx,
              //       layoutRow: layoutRowNum,
              //       featureRow: row,
              //     }
              //   }
              // }
            }
          }
        }
        return
      },
    }))
    .views((self) => ({
      get highestRow() {
        return Math.max(
          0,
          ...self.featureLayouts.map((layout) => Math.max(...layout.keys())),
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
            { name: 'LinearApolloSixFrameDisplaySetSeenFeatures', delay: 1000 },
          ),
        )
      },
    }))
}
