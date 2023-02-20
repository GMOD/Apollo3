import { ConfigurationReference } from '@jbrowse/core/configuration'
import { AnyConfigurationSchemaType } from '@jbrowse/core/configuration/configurationSchema'
import PluginManager from '@jbrowse/core/PluginManager'
import {
  defaultCodonTable,
  generateCodonTable,
  getContainingView,
  getSession,
  revcom,
  reverse,
} from '@jbrowse/core/util'
import { BaseBlock } from '@jbrowse/core/util/blockTypes'
import { getParentRenderProps } from '@jbrowse/core/util/tracks'
import type LinearGenomeViewPlugin from '@jbrowse/plugin-linear-genome-view'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { AnnotationFeatureI } from 'apollo-mst'
import { autorun } from 'mobx'
import { Instance, addDisposer, types } from 'mobx-state-tree'

import { ApolloSession } from '../session'

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
      showStartCodons: true,
      showStopCodons: true,
    })
    .volatile(() => ({
      apolloFeatureUnderMouse: undefined as AnnotationFeatureI | undefined,
      apolloRowUnderMouse: undefined as number | undefined,
    }))
    .views((self) => {
      const { renderProps: superRenderProps } = self
      return {
        renderProps() {
          return {
            ...superRenderProps(),
            ...getParentRenderProps(self),
            config: self.configuration.renderer,
          }
        },
      }
    })
    .views((self) => ({
      get regions() {
        let blockDefinitions
        try {
          ;({ blockDefinitions } = self)
        } catch (error) {
          return []
        }
        const regions = blockDefinitions.contentBlocks.map(
          ({ assemblyName, refName, start, end }) => ({
            assemblyName,
            refName,
            start,
            end,
          }),
        )
        return regions
      },
      regionCannotBeRendered(/* region */) {
        const view = getContainingView(self)
        if (view && view.bpPerPx >= 200) {
          return 'Zoom in to see annotations'
        }
        return undefined
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
                  self.blockDefinitions.contentBlocks.forEach((block) => {
                    blockKeys.push(block.key)
                    if (!previousBlockKeys.includes(block.key)) {
                      newBlocks.push(block)
                    }
                  })
                  session.apolloDataStore.loadRefSeq(
                    newBlocks.map(({ assemblyName, refName, start, end }) => ({
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
        return session.apolloDataStore?.changeManager
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

          // let filteredRef = seq.get(region.start)
          // if (!filteredRef) {
          //   filteredRef = ''
          //   seq.set(region.start, filteredRef)
          // }
          seq.set(region.start, refSeq || '')

          // if (refSeq) {
          //   for (const [featureId, feature] of ref?.features.entries() || new Map()) {
          //     if (region.start < feature.end && region.end > feature.start) {
          //       filteredRef = [refSeq, region.start]
          //     }
          //     seq.set(region.refName, [refSeq, region.start])
          //   }
          // }
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
          for (const [featureId, feature] of ref?.features.entries() ||
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
          let min: number | undefined = undefined
          let max: number | undefined = undefined
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
        const forwardPhaseMap: Record<number, number> = {
          0: 2,
          1: 1,
          2: 0,
        }
        const reversePhaseMap: Record<number, number> = {
          3: 0,
          4: 1,
          5: 2,
        }
        const codonTable = generateCodonTable(defaultCodonTable)
        const codonLayout: Map<
          number,
          {
            letter: string
            codon: string
            reversed: boolean
            start: number
          }[]
        > = new Map()
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
          const translated: {
            letter: string
            codon: string
            reversed: boolean
            start: number
          }[] = []
          const reversed = i in reversePhaseMap
          // the tilt variable normalizes the frame to where we are starting from,
          // which increases consistency across blocks
          let tilt
          // the effectiveFrame incorporates tilt and the frame to say what the
          // effective frame that is plotted. The +3 is for when frame is -2 and this
          // can otherwise result in effectiveFrame -1
          let effectiveFrame
          let seqSliced
          if (!reversed) {
            tilt = 3 - (fullStart % 3)
            effectiveFrame = (forwardPhaseMap[i] + tilt + 3) % 3
            seqSliced = fullSeq.slice(effectiveFrame)
          } else {
            tilt = (fullSeq.length + fullStart) % 3
            effectiveFrame = (reversePhaseMap[i] + tilt + 3) % 3
            seqSliced = reverse(fullSeq).slice(effectiveFrame)
          }
          for (let j = 0; j < seqSliced.length; j += 3) {
            const codon = seqSliced.slice(j, j + 3)
            const normalizedCodon = reversed ? revcom(codon) : codon
            const aminoAcid = codonTable[normalizedCodon] || ''
            translated.push({
              letter: aminoAcid,
              codon: normalizedCodon.toUpperCase(),
              reversed,
              start: reversed
                ? fullStart + seqSliced.length - (3 + j)
                : fullStart + j + effectiveFrame,
            })
          }
          codonLayout.set(i, translated)
        }
        return codonLayout
      },
      get featureLayout() {
        const forwardPhaseMap: Record<number, number> = {
          0: 2,
          1: 1,
          2: 0,
        }
        const featureLayout: Map<number, [number, AnnotationFeatureI][]> =
          new Map()
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
            rows[newRowNumber] = new Array(max - min)
            featureLayout.set(newRowNumber, [])
          }
          Array.from(featuresForRefSeq.values())
            .sort((f1, f2) => {
              const { min: start1, max: end1 } = f1
              const { min: start2, max: end2 } = f2
              return start1 - start2 || end1 - end2
            })
            .forEach((feature) => {
              for (const [, childFeature] of feature.children || new Map()) {
                if (childFeature.type === 'mRNA') {
                  for (const [, grandChildFeature] of childFeature.children ||
                    new Map()) {
                    let startingRow = 0
                    if (grandChildFeature.phase !== undefined) {
                      startingRow = grandChildFeature.phase
                      if (feature.strand === -1) {
                        startingRow += 3
                      } else {
                        startingRow = forwardPhaseMap[grandChildFeature.phase]
                      }
                      const row = rows[startingRow]
                      row.fill(
                        true,
                        grandChildFeature.min - min,
                        grandChildFeature.max - min,
                      )
                      const layoutRow = featureLayout.get(startingRow)
                      layoutRow?.push([0, grandChildFeature])
                    }
                  }
                }
              }
            })
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
        return session.apolloSetSelectedFeature(feature)
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
    }))
    .views((self) => ({
      get highestRow() {
        if (!self.featureLayout.size) {
          return 0
        }
        return Math.max(...self.featureLayout.keys())
      },
      get featuresHeight() {
        return (this.highestRow + 1) * self.apolloRowHeight
      },
      trackMenuItems() {
        return [
          {
            label: 'Show start codons',
            type: 'checkbox',
            checked: self.showStartCodons,
            onClick: () => self.toggleShowStartCodons(),
          },
          {
            label: 'Show stop codons',
            type: 'checkbox',
            checked: self.showStopCodons,
            onClick: () => self.toggleShowStopCodons(),
          },
        ]
      },
    }))
}

export type SixFrameFeatureDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type SixFrameFeatureDisplay = Instance<SixFrameFeatureDisplayStateModel>
