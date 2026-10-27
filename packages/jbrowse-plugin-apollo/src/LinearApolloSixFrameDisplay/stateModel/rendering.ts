/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import type { AnnotationFeature } from '@apollo-annotation/mst'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import {
  defaultCodonTable,
  doesIntersect2,
  getFrame,
  revcom,
} from '@jbrowse/core/util'
import {
  type Instance,
  addDisposer,
  isAlive,
  types,
} from '@jbrowse/mobx-state-tree'
import { type Theme, createTheme } from '@mui/material'
import { autorun, observable } from 'mobx'

import { codonColorCode } from '../../util/displayUtils'
import {
  isCDSFeature,
  isTranscriptFeature,
  looksLikeGene,
} from '../../util/glyphUtils'
import { geneGlyph } from '../glyphs/GeneGlyph'
import { getCDSRow, getStrandRow } from '../rows'

import { baseModelFactory } from './base'

function drawCodon(
  ctx: CanvasRenderingContext2D,
  codon: string,
  leftPx: number,
  index: number,
  theme: Theme,
  highContrast: boolean,
  bpPerPx: number,
  bp: number,
  rowHeight: number,
  showFeatureLabels: boolean,
  showStartCodons: boolean,
  showStopCodons: boolean,
) {
  const strands = [-1, 1] as const
  for (const strand of strands) {
    const frame = getFrame(bp, bp + 3, strand, 0)
    const top = getCDSRow(frame, showFeatureLabels) * rowHeight
    const left = Math.round(leftPx + index / bpPerPx)
    const width = Math.round(3 / bpPerPx) === 0 ? 1 : Math.round(3 / bpPerPx)
    const codonCode = strand === 1 ? codon : revcom(codon)
    const aminoAcidCode =
      defaultCodonTable[codonCode as keyof typeof defaultCodonTable]
    const fillColor = codonColorCode(aminoAcidCode, theme, highContrast)
    if (
      fillColor &&
      ((showStopCodons && aminoAcidCode == '*') ||
        (showStartCodons && aminoAcidCode != '*'))
    ) {
      ctx.fillStyle = fillColor
      ctx.fillRect(left, top, width, rowHeight)
    }
  }
}

export function renderingModelFactory(
  pluginManager: PluginManager,
  configSchema: AnyConfigurationSchemaType,
) {
  const BaseLinearApolloSixFrameDisplay = baseModelFactory(
    pluginManager,
    configSchema,
  )

  return BaseLinearApolloSixFrameDisplay.named(
    'LinearApolloSixFrameDisplayRendering',
  )
    .props({
      apolloRowHeight: 20,
      detailsMinHeight: 200,
      detailsHeight: 200,
      lastRowTooltipBufferHeight: 120,
      isShown: true,
      filteredTranscripts: types.array(types.string),
    })
    .volatile(() => ({
      canvas: null as HTMLCanvasElement | null,
      overlayCanvas: null as HTMLCanvasElement | null,
      collaboratorCanvas: null as HTMLCanvasElement | null,
      theme: createTheme(),
      seenFeatures: observable.map<string, AnnotationFeature>(),
    }))
    .views((self) => ({
      getGlyph(_feature: AnnotationFeature) {
        return geneGlyph
      },
      /** Top-level gene features that overlap the given region */
      getGenesInRegion(region: {
        assemblyName: string
        refName: string
        start: number
        end: number
      }) {
        const assembly = self.session.apolloDataStore.assemblies.get(
          region.assemblyName,
        )
        const features = assembly?.getByRefName(region.refName)?.features
        const genes: AnnotationFeature[] = []
        if (!features) {
          return genes
        }
        for (const [, feature] of features) {
          if (
            doesIntersect2(
              region.start,
              region.end,
              feature.min,
              feature.max,
            ) &&
            looksLikeGene(feature, self.session)
          ) {
            genes.push(feature)
          }
        }
        return genes
      },
      /**
       * 0-based row the feature is drawn in. A transcript is drawn in a row for
       * each of its CDS frames, so if `bp` is given, the row of the CDS
       * containing it is used, otherwise the row of the first CDS.
       */
      getRowForFeature(feature: AnnotationFeature, bp?: number) {
        const { session, showFeatureLabels } = self
        if (isCDSFeature(feature, session)) {
          const transcript = feature.parent
          if (!transcript) {
            return
          }
          for (const cds of transcript.cdsLocations.flat()) {
            if (doesIntersect2(cds.min, cds.max, feature.min, feature.max)) {
              const frame = getFrame(
                cds.min,
                cds.max,
                transcript.strand ?? 1,
                cds.phase,
              )
              return getCDSRow(frame, showFeatureLabels)
            }
          }
          return
        }
        if (isTranscriptFeature(feature, session)) {
          const cdss = feature.cdsLocations.flat()
          const cds =
            bp === undefined
              ? cdss.at(0)
              : cdss.find((c) => bp >= c.min && bp <= c.max)
          if (cds) {
            const frame = getFrame(
              cds.min,
              cds.max,
              feature.strand ?? 1,
              cds.phase,
            )
            return getCDSRow(frame, showFeatureLabels)
          }
        }
        return getStrandRow(feature.strand, showFeatureLabels)
      },
      get highestRow() {
        return 5
      },
    }))
    .views((self) => ({
      get featuresHeight() {
        const featureLabelSpacer = self.showFeatureLabels ? 2 : 1
        return (
          featureLabelSpacer * ((self.highestRow + 1) * self.apolloRowHeight) +
          self.lastRowTooltipBufferHeight
        )
      },
    }))
    .actions((self) => ({
      addSeenFeature(feature: AnnotationFeature) {
        self.seenFeatures.set(feature._id, feature)
      },
      deleteSeenFeature(featureId: string) {
        self.seenFeatures.delete(featureId)
      },
      toggleShown() {
        self.isShown = !self.isShown
      },
      setDetailsHeight(newHeight: number) {
        self.detailsHeight = self.isShown
          ? Math.max(
              Math.min(newHeight, self.height - 100),
              Math.min(self.height, self.detailsMinHeight),
            )
          : newHeight
      },
      setCanvas(canvas: HTMLCanvasElement | null) {
        self.canvas = canvas
      },
      setOverlayCanvas(canvas: HTMLCanvasElement | null) {
        self.overlayCanvas = canvas
      },
      setCollaboratorCanvas(canvas: HTMLCanvasElement | null) {
        self.collaboratorCanvas = canvas
      },
      setTheme(theme: Theme) {
        self.theme = theme
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
              for (const [id, feature] of self.seenFeatures.entries()) {
                if (!isAlive(feature)) {
                  self.deleteSeenFeature(id)
                }
              }
              for (const region of self.regions) {
                const assembly = self.session.apolloDataStore.assemblies.get(
                  region.assemblyName,
                )
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
        addDisposer(
          self,
          autorun(
            () => {
              if (!self.lgv.initialized || self.regionCannotBeRendered()) {
                return
              }
              const ctx = self.collaboratorCanvas?.getContext('2d')
              if (!ctx) {
                return
              }
              ctx.clearRect(
                0,
                0,
                self.lgv.dynamicBlocks.totalWidthPx,
                self.featuresHeight,
              )
              for (const collaborator of self.session.collaborators) {
                const { locations } = collaborator
                if (locations.length === 0) {
                  continue
                }
                let idx = 0
                for (const displayedRegion of self.lgv.displayedRegions) {
                  for (const location of locations) {
                    if (location.refSeq !== displayedRegion.refName) {
                      continue
                    }
                    const { end, refSeq, start } = location
                    const locationStartPxInfo = self.lgv.bpToPx({
                      refName: refSeq,
                      coord: start,
                      regionNumber: idx,
                    })
                    if (!locationStartPxInfo) {
                      continue
                    }
                    const locationStartPx =
                      locationStartPxInfo.offsetPx - self.lgv.offsetPx
                    const locationWidthPx = (end - start) / self.lgv.bpPerPx
                    ctx.fillStyle = 'rgba(0,255,0,.2)'
                    ctx.fillRect(locationStartPx, 1, locationWidthPx, 100)
                    ctx.fillStyle = 'black'
                    ctx.fillText(
                      collaborator.name,
                      locationStartPx + 1,
                      11,
                      locationWidthPx - 2,
                    )
                  }
                  idx++
                }
              }
            },
            { name: 'LinearApolloSixFrameDisplayRenderCollaborators' },
          ),
        )
        addDisposer(
          self,
          autorun(
            () => {
              const {
                apolloRowHeight,
                canvas,
                lgv,
                session,
                theme,
                showFeatureLabels,
                showStartCodons,
                showStopCodons,
              } = self
              if (
                !lgv.initialized ||
                self.regionCannotBeRendered() ||
                !canvas
              ) {
                return
              }
              const { bpPerPx, offsetPx, dynamicBlocks } = lgv

              const ctx = canvas.getContext('2d')
              if (!ctx) {
                return
              }
              ctx.clearRect(0, 0, canvas.width, canvas.height)

              for (const block of dynamicBlocks.contentBlocks) {
                const blockLeftPx = block.offsetPx - offsetPx
                ctx.save()
                ctx.beginPath()
                ctx.rect(blockLeftPx, 0, block.widthPx, canvas.height)
                ctx.clip()
                for (const gene of self.getGenesInRegion(block)) {
                  self.getGlyph(gene).draw(self, ctx, gene, block)
                }

                if (showStartCodons || showStopCodons) {
                  const { apolloDataStore } = session
                  const assembly = apolloDataStore.assemblies.get(
                    block.assemblyName,
                  )
                  const ref = assembly?.getByRefName(block.refName)
                  const roundedStart = Math.floor(block.start)
                  const roundedEnd = Math.ceil(block.end)
                  const seq = ref
                    ?.getSequence(roundedStart, roundedEnd)
                    .toUpperCase()
                  if (seq) {
                    const baseOffsetPx = (block.start - roundedStart) / bpPerPx
                    const seqLeftPx = Math.round(blockLeftPx - baseOffsetPx)
                    for (let i = 0; i < seq.length; i++) {
                      const bp = roundedStart + i
                      const codon = seq.slice(i, i + 3)
                      drawCodon(
                        ctx,
                        codon,
                        seqLeftPx,
                        i,
                        theme,
                        true,
                        bpPerPx,
                        bp,
                        apolloRowHeight,
                        showFeatureLabels,
                        showStartCodons,
                        showStopCodons,
                      )
                    }
                  }
                }
                ctx.restore()
              }
            },
            { name: 'LinearApolloSixFrameDisplayRenderFeatures' },
          ),
        )
      },
    }))
}

export type LinearApolloSixFrameDisplayRenderingModel = ReturnType<
  typeof renderingModelFactory
>
// eslint disable because of
// https://mobx-state-tree.js.org/tips/typescript#using-a-mst-type-at-design-time
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface LinearApolloSixFrameDisplayRendering
  extends Instance<LinearApolloSixFrameDisplayRenderingModel> {}
