/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/unbound-method */
import { AnnotationFeatureI } from '@apollo-annotation/apollo-mst'
import { ConfigurationReference } from '@jbrowse/core/configuration'
import { AnyConfigurationSchemaType } from '@jbrowse/core/configuration/configurationSchema'
import PluginManager from '@jbrowse/core/PluginManager'
import {
  defaultStarts,
  defaultStops,
  getContainingView,
  getSession,
  revcom,
  reverse,
} from '@jbrowse/core/util'
import { BaseBlock } from '@jbrowse/core/util/blockTypes'
import { getParentRenderProps } from '@jbrowse/core/util/tracks'
import type LinearGenomeViewPlugin from '@jbrowse/plugin-linear-genome-view'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { autorun } from 'mobx'
import { Instance, addDisposer, types } from 'mobx-state-tree'

import { ApolloSession, ApolloSessionModel } from '../session'

const forwardPhaseMap: Record<number, number> = { 0: 2, 1: 1, 2: 0 }
const reversePhaseMap: Record<number, number> = { 3: 0, 4: 1, 5: 2 }

export function stateModelFactory(
  pluginManager: PluginManager,
  configSchema: AnyConfigurationSchemaType,
) {
  const LGVPlugin = pluginManager.getPlugin(
    'LinearGenomeViewPlugin',
  ) as LinearGenomeViewPlugin
  const { BaseLinearDisplay } = LGVPlugin.exports

  return BaseLinearDisplay.named('SixFrameFeatureDisplay')
    .props({
      type: types.literal('SixFrameFeatureDisplay'),
      configuration: ConfigurationReference(configSchema),
      apolloRowHeight: 20,
      detailsMinHeight: 200,
      showStartCodons: false,
      showStopCodons: true,
      showIntronLines: true,
    })
    .volatile(() => ({
      apolloFeatureUnderMouse: undefined as AnnotationFeatureI | undefined,
      apolloRowUnderMouse: undefined as number | undefined,
    }))
    .views((self) => {
      const { configuration, renderProps: superRenderProps } = self
      return {
        renderProps() {
          return {
            ...superRenderProps(),
            ...getParentRenderProps(self),
            config: configuration.renderer,
          }
        },
      }
    })
    .views((self) => ({
      get regions() {
        let blockDefinitions
        try {
          ;({ blockDefinitions } = self)
        } catch {
          return []
        }
        const regions = blockDefinitions.contentBlocks.map(
          ({ assemblyName, end, refName, start }) => ({
            assemblyName,
            refName,
            start,
            end,
          }),
        )
        return regions
      },
      regionCannotBeRendered(/* region */) {
        const view = getContainingView(self) as unknown as LinearGenomeViewModel
        if (view && view.bpPerPx >= 200) {
          return 'Zoom in to see annotations'
        }
        return
      },
      get session() {
        return getSession(self) as unknown as ApolloSessionModel
      },
    }))
    .actions((self) => {
      let previousBlockKeys: string[] = []
      return {
        afterAttach() {
          addDisposer(
            self,
            autorun(
              () => {
                const session = getSession(self) as ApolloSession
                const view = getContainingView(
                  self,
                ) as unknown as LinearGenomeViewModel
                if (view.initialized) {
                  if (self.regionCannotBeRendered()) {
                    return
                  }
                  const blockKeys: string[] = []
                  const newBlocks: BaseBlock[] = []
                  for (const block of self.blockDefinitions.contentBlocks) {
                    blockKeys.push(block.key)
                    if (!previousBlockKeys.includes(block.key)) {
                      newBlocks.push(block)
                    }
                  }
                  session.apolloDataStore.loadFeatures(
                    newBlocks.map(({ assemblyName, end, refName, start }) => ({
                      assemblyName,
                      refName,
                      start,
                      end,
                    })),
                  )
                  session.apolloDataStore.loadRefSeq(
                    newBlocks.map(({ assemblyName, end, refName, start }) => ({
                      assemblyName,
                      refName,
                      start,
                      end,
                    })),
                  )
                  previousBlockKeys = blockKeys
                }
              },
              { name: 'SixFrameFeatureDisplay' },
            ),
          )
        },
      }
    })
    .views((self) => ({
      get rendererTypeName() {
        return self.configuration.renderer.type
      },
      get changeManager() {
        const session = getSession(self) as ApolloSession
        return session.apolloDataStore.changeManager
      },
      get sequence() {
        const { regions } = self
        const session = getSession(self) as ApolloSession
        const seq = new Map<number, string>()
        for (const region of regions) {
          const assembly = session.apolloDataStore.assemblies.get(
            region.assemblyName,
          )
          const ref = assembly?.getByRefName(region.refName)
          const refSeq: string | undefined = ref?.getSequence(
            region.start,
            region.end,
          )
          seq.set(region.start, refSeq ?? '')
        }
        return seq
      },
      get features() {
        const { regions } = self
        const session = getSession(self) as ApolloSession
        const features = new Map<string, Map<string, AnnotationFeatureI>>()
        for (const region of regions) {
          const assembly = session.apolloDataStore.assemblies.get(
            region.assemblyName,
          )
          const ref = assembly?.getByRefName(region.refName)
          let filteredRef = features.get(region.refName)
          if (!filteredRef) {
            filteredRef = new Map<string, AnnotationFeatureI>()
            features.set(region.refName, filteredRef)
          }
          for (const [featureId, feature] of ref?.features.entries() ??
            new Map()) {
            if (region.start < feature.end && region.end > feature.start) {
              filteredRef.set(featureId, feature)
            }
          }
        }
        return features
      },
      get featuresMinMax() {
        const minMax: Record<string, [number, number]> = {}
        for (const [refSeq, featuresForRefSeq] of this.features || []) {
          let min: number | undefined
          let max: number | undefined
          for (const [, featureLocation] of featuresForRefSeq) {
            if (min === undefined) {
              ;({ min } = featureLocation)
            }
            if (max === undefined) {
              ;({ max } = featureLocation)
            }
            if (featureLocation.min < min) {
              ;({ min } = featureLocation)
            }
            if (featureLocation.end > max) {
              ;({ max } = featureLocation)
            }
          }
          if (min !== undefined && max !== undefined) {
            minMax[refSeq] = [min, max]
          }
        }
        return minMax
      },
      get codonLayout() {
        const codonLayout = new Map<
          number,
          { starts: number[]; stops: number[] }
        >()
        let fullSeq = ''
        let fullStart = 0
        for (const [regionStart, seq] of this.sequence || []) {
          if (!seq) {
            continue
          }
          if (!fullSeq) {
            fullStart = regionStart
          }
          fullSeq += seq
        }
        const rowCount = 6
        for (let i = 0; i < rowCount; i++) {
          const starts: number[] = []
          const stops: number[] = []
          const reversed = i in reversePhaseMap
          // the tilt variable normalizes the frame to where we are starting from,
          // which increases consistency across blocks
          let tilt
          // the effectiveFrame incorporates tilt and the frame to say what the
          // effective frame that is plotted. The +3 is for when frame is -2 and this
          // can otherwise result in effectiveFrame -1
          let effectiveFrame
          let seqSliced
          if (reversed) {
            tilt = (fullSeq.length + fullStart) % 3
            effectiveFrame = (reversePhaseMap[i] + tilt + 3) % 3
            seqSliced = reverse(fullSeq).slice(effectiveFrame)
          } else {
            tilt = 3 - (fullStart % 3)
            effectiveFrame = (forwardPhaseMap[i] + tilt + 3) % 3
            seqSliced = fullSeq.slice(effectiveFrame)
          }
          for (let j = 0; j < seqSliced.length; j += 3) {
            const codon = seqSliced.slice(j, j + 3)
            const normalizedCodon = reversed ? reverse(revcom(codon)) : codon
            const start = reversed
              ? fullStart + seqSliced.length - (3 + j)
              : fullStart + j + effectiveFrame
            if (defaultStarts.includes(normalizedCodon.toUpperCase())) {
              starts.push(start)
            } else if (defaultStops.includes(normalizedCodon.toUpperCase())) {
              stops.push(start)
            }
          }
          codonLayout.set(i, { starts, stops })
        }
        return codonLayout
      },
      get featureLayout() {
        const featureLayout = new Map<number, [string, AnnotationFeatureI][]>()
        for (const [refSeq, featuresForRefSeq] of this.features || []) {
          if (!featuresForRefSeq) {
            continue
          }
          const minMaxfeatures = this.featuresMinMax[refSeq]
          if (!minMaxfeatures) {
            continue
          }
          const [min, max] = minMaxfeatures
          const rows: boolean[][] = []
          const rowCount = 6
          for (let i = 0; i < rowCount; i++) {
            const newRowNumber = rows.length
            rows[newRowNumber] = Array.from({ length: max - min })
            featureLayout.set(newRowNumber, [])
          }
          for (const feature of [...featuresForRefSeq.values()].sort(
            (f1, f2) => {
              const { max: end1, min: start1 } = f1
              const { max: end2, min: start2 } = f2
              return start1 - start2 || end1 - end2
            },
          )) {
            for (const [, childFeature] of feature.children ?? new Map()) {
              if (childFeature.type === 'mRNA') {
                for (const [, grandChildFeature] of childFeature.children ||
                  new Map()) {
                  let startingRow
                  if (grandChildFeature.type === 'CDS') {
                    let discontinuousLocations
                    if (grandChildFeature.discontinuousLocations.length > 0) {
                      ;({ discontinuousLocations } = grandChildFeature)
                    } else {
                      discontinuousLocations = [grandChildFeature]
                    }
                    for (const cds of discontinuousLocations) {
                      const min = cds.start + 3
                      const max = cds.end - 3
                      // Remove codons either end of feature when considering intersect.
                      for (const [row, { stops }] of this.codonLayout) {
                        if (
                          (row < 3 && feature.strand === 1) ||
                          (row >= 3 && feature.strand === -1)
                        ) {
                          const filteredArray = stops.filter(
                            (value) => value >= min && value <= max,
                          )
                          if (filteredArray.length === 0) {
                            startingRow = row
                            const layoutRow = featureLayout.get(startingRow)
                            layoutRow?.push([childFeature.featureId, cds])
                            break
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
        return featureLayout
      },
      getAssemblyId(assemblyName: string) {
        const { assemblyManager } = getSession(self)
        const assembly = assemblyManager.get(assemblyName)
        if (!assembly) {
          throw new Error(`Could not find assembly named ${assemblyName}`)
        }
        return assembly.name
      },
      get selectedFeature(): AnnotationFeatureI | undefined {
        const session = getSession(self) as ApolloSession
        return session.apolloSelectedFeature
      },
      get setSelectedFeature() {
        const session = getSession(self) as ApolloSession
        return session.apolloSetSelectedFeature
      },
    }))
    .actions((self) => ({
      setSelectedFeature(feature?: AnnotationFeatureI) {
        const session = getSession(self) as ApolloSession
        session.apolloSetSelectedFeature(feature)
      },
      setApolloFeatureUnderMouse(feature?: AnnotationFeatureI) {
        self.apolloFeatureUnderMouse = feature
      },
      setApolloRowUnderMouse(row?: number) {
        self.apolloRowUnderMouse = row
      },
      toggleShowStartCodons() {
        self.showStartCodons = !self.showStartCodons
      },
      toggleShowStopCodons() {
        self.showStopCodons = !self.showStopCodons
      },
      toggleShowIntronLines() {
        self.showIntronLines = !self.showIntronLines
      },
    }))
    .views((self) => ({
      get highestRow() {
        if (self.featureLayout.size === 0) {
          return 0
        }
        return Math.max(...self.featureLayout.keys())
      },
      get featuresHeight() {
        return (this.highestRow + 1) * self.apolloRowHeight
      },
      get detailsHeight() {
        return Math.max(
          self.detailsMinHeight,
          self.height - this.featuresHeight,
        )
      },
      trackMenuItems() {
        return [
          {
            label: 'Show start codons',
            type: 'checkbox',
            checked: self.showStartCodons,
            onClick: () => {
              self.toggleShowStartCodons()
            },
          },
          {
            label: 'Show stop codons',
            type: 'checkbox',
            checked: self.showStopCodons,
            onClick: () => {
              self.toggleShowStopCodons()
            },
          },
          {
            label: 'Show intron lines',
            type: 'checkbox',
            checked: self.showIntronLines,
            onClick: () => {
              self.toggleShowIntronLines()
            },
          },
        ]
      },
    }))
}

export type SixFrameFeatureDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type SixFrameFeatureDisplay = Instance<SixFrameFeatureDisplayStateModel>
