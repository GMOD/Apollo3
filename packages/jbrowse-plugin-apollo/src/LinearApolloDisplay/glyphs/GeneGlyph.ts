import type { AnnotationFeature } from '@apollo-annotation/mst'
import { readConfObject } from '@jbrowse/core/configuration'
import type { BaseDisplayModel } from '@jbrowse/core/pluggableElementTypes'
import type { MenuItem } from '@jbrowse/core/ui'
import {
  type AbstractSessionModel,
  getContainingView,
  intersection2,
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'
import type { ContentBlock } from '@jbrowse/core/util/blockTypes'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { alpha } from '@mui/material'

import type { OntologyRecord } from '../../OntologyManager'
import { MergeExons, MergeTranscripts, SplitExon } from '../../components'
import {
  type MousePosition,
  type MousePositionWithFeature,
  containsSelectedFeature,
  getAdjacentExons,
  getMinAndMaxPx,
  getOverlappingEdge,
  getStreamIcon,
  isCDSFeature,
  isExonFeature,
  isMousePositionWithFeature,
  isTranscriptFeature,
  navToFeatureCenter,
  selectFeatureAndOpenWidget,
} from '../../util'
import { getRelatedFeatures } from '../../util/annotationFeatureUtils'
import type { LinearApolloDisplay } from '../stateModel'
import type { LinearApolloDisplayMouseEvents } from '../stateModel/mouseEvents'
import type { CanvasMouseEvent } from '../types'

import { boxGlyph } from './BoxGlyph'
import type { Glyph } from './Glyph'
import { transcriptGlyph } from './TranscriptGlyph'

function getDraggableFeatureInfo(
  mousePosition: MousePosition,
  feature: AnnotationFeature,
  stateModel: LinearApolloDisplay,
): { feature: AnnotationFeature; edge: 'min' | 'max' } | undefined {
  const { session } = stateModel
  const { apolloDataStore } = session
  const { featureTypeOntology } = apolloDataStore.ontologyManager
  if (!featureTypeOntology) {
    throw new Error('featureTypeOntology is undefined')
  }
  const isGene =
    featureTypeOntology.isTypeOf(feature.type, 'gene') ||
    featureTypeOntology.isTypeOf(feature.type, 'pseudogene')
  const isTranscript =
    featureTypeOntology.isTypeOf(feature.type, 'transcript') ||
    featureTypeOntology.isTypeOf(feature.type, 'pseudogenic_transcript')
  const isCDS = featureTypeOntology.isTypeOf(feature.type, 'CDS')
  if (isGene || isTranscript) {
    // For gene glyphs, the sizes of genes and transcripts are determined by
    // their child exons, so we don't make them draggable
    return
  }
  // So now the type of feature is either CDS or exon. If an exon and CDS edge
  // are in the same place, we want to prioritize dragging the exon. If the
  // feature we're on is a CDS, let's find any exon it may overlap.
  const { bp, refName, regionNumber, x } = mousePosition
  const { lgv } = stateModel
  if (isCDS) {
    const transcript = feature.parent
    if (!transcript?.children) {
      return
    }
    const exonChildren: AnnotationFeature[] = []
    for (const child of transcript.children.values()) {
      const childIsExon = featureTypeOntology.isTypeOf(child.type, 'exon')
      if (childIsExon) {
        exonChildren.push(child)
      }
    }
    const overlappingExon = exonChildren.find((child) => {
      const [start, end] = intersection2(bp - 1, bp, child.min, child.max)
      return start !== undefined && end !== undefined
    })
    if (overlappingExon) {
      // We are on an exon, are we on the edge of it?
      const minMax = getMinAndMaxPx(overlappingExon, refName, regionNumber, lgv)
      if (minMax) {
        const overlappingEdge = getOverlappingEdge(overlappingExon, x, minMax)
        if (overlappingEdge) {
          return overlappingEdge
        }
      }
    }
  }
  // End of special cases, let's see if we're on the edge of this CDS or exon
  const minMax = getMinAndMaxPx(feature, refName, regionNumber, lgv)
  if (minMax) {
    const overlappingEdge = getOverlappingEdge(feature, x, minMax)
    if (overlappingEdge) {
      return overlappingEdge
    }
  }
  return
}

/**
 * A list of all the subfeatures for each row for a given feature, as well as
 * the feature itself.
 * If the row contains a transcript, the order is CDS -\> exon -\> transcript -\> gene
 * If the row does not contain an transcript, the order is subfeature -\> gene
 */
function featuresForRow(
  feature: AnnotationFeature,
  featureTypeOntology: OntologyRecord,
): AnnotationFeature[][] {
  const isGene =
    featureTypeOntology.isTypeOf(feature.type, 'gene') ||
    featureTypeOntology.isTypeOf(feature.type, 'pseudogene')
  if (!isGene) {
    throw new Error('Top level feature for GeneGlyph must have type "gene"')
  }
  const { children } = feature
  if (!children) {
    return [[feature]]
  }
  const features: AnnotationFeature[][] = []
  for (const [, child] of children) {
    if (
      !(
        featureTypeOntology.isTypeOf(child.type, 'transcript') ||
        featureTypeOntology.isTypeOf(child.type, 'pseudogenic_transcript')
      )
    ) {
      features.push([child, feature])
      continue
    }
    if (!child.children) {
      continue
    }
    const cdss: AnnotationFeature[] = []
    const exons: AnnotationFeature[] = []
    for (const [, grandchild] of child.children) {
      if (featureTypeOntology.isTypeOf(grandchild.type, 'CDS')) {
        cdss.push(grandchild)
      } else if (featureTypeOntology.isTypeOf(grandchild.type, 'exon')) {
        exons.push(grandchild)
      }
    }
    for (const cds of cdss) {
      features.push([cds, ...exons, child, feature])
    }
    if (cdss.length === 0) {
      features.push([...exons, child, feature])
    }
  }
  return features
}

function drawBackground(
  display: LinearApolloDisplay,
  ctx: CanvasRenderingContext2D,
  feature: AnnotationFeature,
  row: number,
  block: ContentBlock,
  color?: string,
) {
  const { apolloRowHeight, lgv, session, theme } = display
  const { bpPerPx, offsetPx } = lgv
  const { refName, reversed } = block

  const topLevelFeatureMinX =
    (lgv.bpToPx({
      refName,
      coord: feature.min,
      regionNumber: block.regionNumber,
    })?.offsetPx ?? 0) - offsetPx
  const topLevelFeatureWidthPx = feature.length / bpPerPx
  const topLevelFeatureStartPx = reversed
    ? topLevelFeatureMinX - topLevelFeatureWidthPx
    : topLevelFeatureMinX
  const topLevelFeatureTop = row * apolloRowHeight
  const topLevelFeatureHeight = getRowCount(display, feature) * apolloRowHeight

  let selectedColor
  if (color) {
    selectedColor = color
  } else {
    selectedColor = readConfObject(
      session.getPluginConfiguration(),
      'geneBackgroundColor',
      { featureType: feature.type },
    ) as string
    if (!selectedColor) {
      selectedColor = alpha(theme.palette.background.paper, 0.6)
    }
  }
  ctx.fillStyle = selectedColor
  ctx.fillRect(
    topLevelFeatureStartPx,
    topLevelFeatureTop,
    topLevelFeatureWidthPx,
    topLevelFeatureHeight,
  )
}

function drawHighlight(
  stateModel: LinearApolloDisplay,
  ctx: CanvasRenderingContext2D,
  feature: AnnotationFeature,
  selected = false,
) {
  const { apolloRowHeight, lgv, session, theme } = stateModel
  const { featureTypeOntology } = session.apolloDataStore.ontologyManager

  const position = stateModel.getFeatureLayoutPosition(feature)
  if (!position) {
    return
  }
  const { bpPerPx, displayedRegions, offsetPx } = lgv
  const { featureRow, layoutIndex, layoutRow } = position
  const displayedRegion = displayedRegions[layoutIndex]
  const { refName, reversed } = displayedRegion
  const { length, max, min } = feature
  const startPx =
    (lgv.bpToPx({
      refName,
      coord: reversed ? max : min,
      regionNumber: layoutIndex,
    })?.offsetPx ?? 0) - offsetPx
  const row = layoutRow + featureRow
  const top = row * apolloRowHeight
  const widthPx = length / bpPerPx
  ctx.fillStyle = selected
    ? theme.palette.action.disabled
    : theme.palette.action.focus

  if (!featureTypeOntology) {
    throw new Error('featureTypeOntology is undefined')
  }
  ctx.fillRect(
    startPx,
    top,
    widthPx,
    apolloRowHeight * getRowCount(stateModel, feature),
  )
}

function draw(
  display: LinearApolloDisplay,
  ctx: CanvasRenderingContext2D,
  feature: AnnotationFeature,
  row: number,
  block: ContentBlock,
): void {
  const { selectedFeature, session } = display
  const { children } = feature
  if (!children) {
    return
  }
  const { apolloDataStore } = session
  const { featureTypeOntology } = apolloDataStore.ontologyManager
  if (!featureTypeOntology) {
    throw new Error('featureTypeOntology is undefined')
  }

  // Draw background for gene
  drawBackground(display, ctx, feature, row, block)

  // Draw lines on different rows for each transcript
  let currentRow = 0
  for (const [, transcript] of children) {
    const isTranscript = isTranscriptFeature(transcript, session)
    if (!isTranscript) {
      currentRow += 1
      continue
    }
    const transcriptRowCount = transcriptGlyph.getRowCount(display, transcript)
    transcriptGlyph.draw(display, ctx, transcript, row + currentRow, block)
    currentRow += transcriptRowCount
  }

  // Draw exon and CDS for each transcript
  currentRow = 0
  for (const [, child] of children) {
    if (
      !(
        featureTypeOntology.isTypeOf(child.type, 'transcript') ||
        featureTypeOntology.isTypeOf(child.type, 'pseudogenic_transcript')
      )
    ) {
      boxGlyph.draw(display, ctx, child, row, block)
      currentRow += 1
      continue
    }
  }
  if (selectedFeature && containsSelectedFeature(feature, selectedFeature)) {
    drawHighlight(display, ctx, selectedFeature, true)
  }
}

function drawDragPreview(
  stateModel: LinearApolloDisplay,
  overlayCtx: CanvasRenderingContext2D,
) {
  const { apolloDragging, apolloRowHeight, lgv, theme } = stateModel
  const { bpPerPx, displayedRegions, offsetPx } = lgv
  if (!apolloDragging) {
    return
  }
  const { current, edge, feature, start } = apolloDragging

  const row = Math.floor(start.y / apolloRowHeight)
  const region = displayedRegions[start.regionNumber]
  const rowCount = 1
  const featureEdgeBp = region.reversed
    ? region.end - feature[edge]
    : feature[edge] - region.start
  const featureEdgePx = featureEdgeBp / bpPerPx - offsetPx
  const rectX = Math.min(current.x, featureEdgePx)
  const rectY = row * apolloRowHeight
  const rectWidth = Math.abs(current.x - featureEdgePx)
  const rectHeight = apolloRowHeight * rowCount
  overlayCtx.strokeStyle = theme.palette.info.main
  overlayCtx.setLineDash([6])
  overlayCtx.strokeRect(rectX, rectY, rectWidth, rectHeight)
  overlayCtx.fillStyle = alpha(theme.palette.info.main, 0.2)
  overlayCtx.fillRect(rectX, rectY, rectWidth, rectHeight)
}

function drawHover(
  stateModel: LinearApolloDisplay,
  ctx: CanvasRenderingContext2D,
) {
  const { hoveredFeature } = stateModel

  if (!hoveredFeature) {
    return
  }
  drawHighlight(stateModel, ctx, hoveredFeature.feature)
}

function getFeatureFromLayout(
  feature: AnnotationFeature,
  bp: number,
  row: number,
  featureTypeOntology: OntologyRecord,
): AnnotationFeature | undefined {
  const featureInThisRow: AnnotationFeature[] =
    featuresForRow(feature, featureTypeOntology)[row] || []
  for (const f of featureInThisRow) {
    let featureObj
    if (bp >= f.min && bp <= f.max && f.parent) {
      featureObj = f
    }
    if (!featureObj) {
      continue
    }
    if (
      featureTypeOntology.isTypeOf(featureObj.type, 'CDS') &&
      featureObj.parent &&
      (featureTypeOntology.isTypeOf(featureObj.parent.type, 'transcript') ||
        featureTypeOntology.isTypeOf(
          featureObj.parent.type,
          'pseudogenic_transcript',
        ))
    ) {
      const { cdsLocations } = featureObj.parent
      for (const cdsLoc of cdsLocations) {
        for (const loc of cdsLoc) {
          if (bp >= loc.min && bp <= loc.max) {
            return featureObj
          }
        }
      }

      // If mouse position is in the intron region, return the transcript
      return featureObj.parent
    }
    // If mouse position is in a feature that is not a CDS, return the feature
    return featureObj
  }
  return feature
}

function getRowCount(
  display: LinearApolloDisplay,
  feature: AnnotationFeature,
): number {
  const { children } = feature
  if (!children) {
    return 1
  }
  const { session } = display
  const isTranscript = isTranscriptFeature(feature, session)
  let rowCount = 0
  if (isTranscript) {
    for (const [, child] of children) {
      if (isCDSFeature(child, session)) {
        rowCount += 1
      }
    }

    // return 1 if there are no CDSs for non coding genes
    return rowCount === 0 ? 1 : rowCount
  }
  for (const [, child] of children) {
    rowCount += getRowCount(display, child)
  }
  return rowCount
}

function getRowForFeature(
  feature: AnnotationFeature,
  childFeature: AnnotationFeature,
  featureTypeOntology: OntologyRecord,
) {
  const rows = featuresForRow(feature, featureTypeOntology)
  for (const [idx, row] of rows.entries()) {
    if (row.some((feature) => feature._id === childFeature._id)) {
      return idx
    }
  }
  return
}

function onMouseDown(
  stateModel: LinearApolloDisplay,
  currentMousePosition: MousePositionWithFeature,
  event: CanvasMouseEvent,
) {
  const { feature } = currentMousePosition
  // swallow the mouseDown if we are on the edge of the feature so that we
  // don't start dragging the view if we try to drag the feature edge
  const draggableFeature = getDraggableFeatureInfo(
    currentMousePosition,
    feature,
    stateModel,
  )
  if (draggableFeature) {
    event.stopPropagation()
    stateModel.startDrag(
      currentMousePosition,
      draggableFeature.feature,
      draggableFeature.edge,
      true,
    )
  }
}

function onMouseMove(
  stateModel: LinearApolloDisplay,
  mousePosition: MousePosition,
) {
  if (isMousePositionWithFeature(mousePosition)) {
    const { feature, bp } = mousePosition
    stateModel.setHoveredFeature({ feature, bp })
    const draggableFeature = getDraggableFeatureInfo(
      mousePosition,
      feature,
      stateModel,
    )
    if (draggableFeature) {
      stateModel.setCursor('col-resize')
      return
    }
  }
  stateModel.setCursor()
}

function onMouseUp(
  stateModel: LinearApolloDisplay,
  mousePosition: MousePosition,
) {
  if (stateModel.apolloDragging) {
    return
  }
  const { feature } = mousePosition
  if (!feature) {
    return
  }
  selectFeatureAndOpenWidget(stateModel, feature)
}

function getContextMenuItems(
  display: LinearApolloDisplayMouseEvents,
  mousePosition: MousePositionWithFeature,
): MenuItem[] {
  const {
    apolloInternetAccount: internetAccount,
    hoveredFeature,
    changeManager,
    regions,
    selectedFeature,
    session,
  } = display
  const [region] = regions
  const currentAssemblyId = display.getAssemblyId(region.assemblyName)
  const menuItems: MenuItem[] = []
  const role = internetAccount ? internetAccount.role : 'admin'
  const admin = role === 'admin'
  if (!hoveredFeature) {
    return menuItems
  }

  if (isMousePositionWithFeature(mousePosition)) {
    const { bp, feature } = mousePosition
    let featuresUnderClick = getRelatedFeatures(feature, bp)
    if (isCDSFeature(feature, session)) {
      featuresUnderClick = getRelatedFeatures(feature, bp, true)
    }

    for (const feature of featuresUnderClick) {
      const contextMenuItemsForFeature = boxGlyph.getContextMenuItemsForFeature(
        display,
        feature,
      )
      if (isExonFeature(feature, session)) {
        const adjacentExons = getAdjacentExons(
          feature,
          display,
          mousePosition,
          session,
        )
        const lgv = getContainingView(
          display as BaseDisplayModel,
        ) as unknown as LinearGenomeViewModel
        if (adjacentExons.upstream) {
          const exon = adjacentExons.upstream
          contextMenuItemsForFeature.push({
            label: 'Go to upstream exon',
            icon: getStreamIcon(
              feature.strand,
              true,
              lgv.displayedRegions.at(0)?.reversed,
            ),
            onClick: () => {
              lgv.navTo(navToFeatureCenter(exon, 0.1, lgv.totalBp))
              selectFeatureAndOpenWidget(display, exon)
            },
          })
        }
        if (adjacentExons.downstream) {
          const exon = adjacentExons.downstream
          contextMenuItemsForFeature.push({
            label: 'Go to downstream exon',
            icon: getStreamIcon(
              feature.strand,
              false,
              lgv.displayedRegions.at(0)?.reversed,
            ),
            onClick: () => {
              lgv.navTo(navToFeatureCenter(exon, 0.1, lgv.totalBp))
              selectFeatureAndOpenWidget(display, exon)
            },
          })
        }
        contextMenuItemsForFeature.push(
          {
            label: 'Merge exons',
            disabled: !admin,
            onClick: () => {
              ;(session as unknown as AbstractSessionModel).queueDialog(
                (doneCallback) => [
                  MergeExons,
                  {
                    session,
                    handleClose: () => {
                      doneCallback()
                    },
                    changeManager,
                    sourceFeature: feature,
                    sourceAssemblyId: currentAssemblyId,
                    selectedFeature,
                    setSelectedFeature: (feature?: AnnotationFeature) => {
                      display.setSelectedFeature(feature)
                    },
                  },
                ],
              )
            },
          },
          {
            label: 'Split exon',
            disabled: !admin,
            onClick: () => {
              ;(session as unknown as AbstractSessionModel).queueDialog(
                (doneCallback) => [
                  SplitExon,
                  {
                    session,
                    handleClose: () => {
                      doneCallback()
                    },
                    changeManager,
                    sourceFeature: feature,
                    sourceAssemblyId: currentAssemblyId,
                    selectedFeature,
                    setSelectedFeature: (feature?: AnnotationFeature) => {
                      display.setSelectedFeature(feature)
                    },
                  },
                ],
              )
            },
          },
        )
      }
      if (isTranscriptFeature(feature, session)) {
        contextMenuItemsForFeature.push({
          label: 'Merge transcript',
          onClick: () => {
            ;(session as unknown as AbstractSessionModel).queueDialog(
              (doneCallback) => [
                MergeTranscripts,
                {
                  session,
                  handleClose: () => {
                    doneCallback()
                  },
                  changeManager,
                  sourceFeature: feature,
                  sourceAssemblyId: currentAssemblyId,
                  selectedFeature,
                  setSelectedFeature: (feature?: AnnotationFeature) => {
                    display.setSelectedFeature(feature)
                  },
                },
              ],
            )
          },
        })
        if (isSessionModelWithWidgets(session)) {
          contextMenuItemsForFeature.splice(1, 0, {
            label: 'Open transcript editor',
            onClick: () => {
              const apolloTranscriptWidget = session.addWidget(
                'ApolloTranscriptDetails',
                'apolloTranscriptDetails',
                {
                  feature,
                  assembly: currentAssemblyId,
                  changeManager,
                  refName: region.refName,
                },
              )
              session.showWidget(apolloTranscriptWidget)
            },
          })
        }
      }
      menuItems.push({
        label: feature.type,
        subMenu: contextMenuItemsForFeature,
      })
    }
  }
  return menuItems
}

// False positive here, none of these functions use "this"
/* eslint-disable @typescript-eslint/unbound-method */
const { drawTooltip, getContextMenuItemsForFeature, onMouseLeave } = boxGlyph
/* eslint-enable @typescript-eslint/unbound-method */

export const geneGlyph: Glyph = {
  draw,
  drawDragPreview,
  drawHover,
  drawTooltip,
  getContextMenuItems,
  getContextMenuItemsForFeature,
  getFeatureFromLayout,
  getRowCount,
  getRowForFeature,
  onMouseDown,
  onMouseLeave,
  onMouseMove,
  onMouseUp,
}
