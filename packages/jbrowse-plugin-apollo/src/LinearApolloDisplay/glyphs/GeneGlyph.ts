import type { AnnotationFeature } from '@apollo-annotation/mst'
import { readConfObject } from '@jbrowse/core/configuration'
import type { BaseDisplayModel } from '@jbrowse/core/pluggableElementTypes'
import type { MenuItem } from '@jbrowse/core/ui'
import {
  type AbstractSessionModel,
  getContainingView,
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'
import type { ContentBlock } from '@jbrowse/core/util/blockTypes'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { alpha } from '@mui/material'

import { MergeExons, MergeTranscripts, SplitExon } from '../../components'
import {
  type MousePositionWithFeature,
  getAdjacentExons,
  getStreamIcon,
  isCDSFeature,
  isExonFeature,
  isMousePositionWithFeature,
  isSelectedFeature,
  isTranscriptFeature,
  navToFeatureCenter,
  selectFeatureAndOpenWidget,
} from '../../util'
import { getRelatedFeatures } from '../../util/annotationFeatureUtils'
import type { LinearApolloDisplay } from '../stateModel'
import type { LinearApolloDisplayMouseEvents } from '../stateModel/mouseEvents'

import { boxGlyph } from './BoxGlyph'
import type { Glyph } from './Glyph'
import { transcriptGlyph } from './TranscriptGlyph'
import { drawHighlight, getFeatureBox, strokeRectInner } from './util'

interface LayoutRow {
  feature: AnnotationFeature
  glyph: Glyph
  rowInFeature: number
}

function getLayoutRows(
  display: LinearApolloDisplay,
  feature: AnnotationFeature,
): LayoutRow[] {
  const { children } = feature
  if (!children) {
    return []
  }
  const rows: LayoutRow[] = []
  const { session } = display
  for (const [, child] of children) {
    const isTranscript = isTranscriptFeature(child, session)
    const glyph = isTranscript ? transcriptGlyph : boxGlyph
    const newRowCount = glyph.getRowCount(display, child)
    for (let i = 0; i < newRowCount; i++) {
      rows.push({ feature: child, glyph, rowInFeature: i })
    }
  }

  return rows
}

function draw(
  display: LinearApolloDisplay,
  ctx: CanvasRenderingContext2D,
  gene: AnnotationFeature,
  row: number,
  block: ContentBlock,
): void {
  const { apolloRowHeight, theme, selectedFeature, session } = display
  const [top, left, width] = getFeatureBox(display, gene, row, block)
  const height = getRowCount(display, gene) * apolloRowHeight
  if (width > 2) {
    let selectedColor = readConfObject(
      session.getPluginConfiguration(),
      'geneBackgroundColor',
      { featureType: gene.type },
    ) as string
    selectedColor = alpha(theme.palette.background.paper, 0.6)
    ctx.fillStyle = selectedColor
    ctx.fillRect(left, top, width, height)
  }
  strokeRectInner(ctx, left, top, width, height, theme.palette.text.primary)
  const { children } = gene
  if (!children) {
    return
  }

  // Draw children of gene on their own rows
  const rows = getLayoutRows(display, gene)
  for (const [idx, layoutRow] of rows.entries()) {
    const { feature: rowFeature, glyph, rowInFeature } = layoutRow
    if (rowInFeature > 1) {
      continue
    }
    glyph.draw(display, ctx, rowFeature, row + idx, block)
  }

  if (isSelectedFeature(gene, selectedFeature)) {
    drawHighlight(display, ctx, left, top, width, height, true)
  }
}

function drawHover(
  display: LinearApolloDisplay,
  ctx: CanvasRenderingContext2D,
  gene: AnnotationFeature,
  row: number,
  block: ContentBlock,
) {
  const { apolloRowHeight } = display
  const [top, left, width] = getFeatureBox(display, gene, row, block)
  const height = getRowCount(display, gene) * apolloRowHeight
  drawHighlight(display, ctx, left, top, width, height)
}

function getRowCount(
  display: LinearApolloDisplay,
  feature: AnnotationFeature,
): number {
  const layoutRows = getLayoutRows(display, feature)
  if (layoutRows.length === 0) {
    return 1
  }
  return layoutRows.length
}

function getFeatureFromLayout(
  display: LinearApolloDisplay,
  feature: AnnotationFeature,
  bp: number,
  row: number,
) {
  const layoutRow = getLayoutRows(display, feature).at(row)
  if (!layoutRow) {
    return
  }
  const { feature: rowFeature, glyph, rowInFeature } = layoutRow
  const subFeature = glyph.getFeatureFromLayout(
    display,
    rowFeature,
    bp,
    rowInFeature,
  )
  if (subFeature) {
    return subFeature
  }
  if (bp >= feature.min && bp <= feature.max) {
    return feature
  }
  return
}

function getRowForFeature(
  display: LinearApolloDisplay,
  feature: AnnotationFeature,
  childFeature: AnnotationFeature,
) {
  const rows = getLayoutRows(display, feature)
  for (const [idx, row] of rows.entries()) {
    if (row.feature._id === childFeature._id) {
      return idx
    }
    const subFeatureRow = row.glyph.getRowForFeature(
      display,
      row.feature,
      childFeature,
    )
    if (subFeatureRow !== undefined) {
      return subFeatureRow + idx
    }
  }
  return
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

// Genes are not draggable, only the underlying exons and CDS are
// eslint-disable-next-line @typescript-eslint/no-empty-function
function onMouseDown() {}

function onMouseMove(
  stateModel: LinearApolloDisplay,
  mousePosition: MousePositionWithFeature,
) {
  const { feature, bp } = mousePosition
  stateModel.setHoveredFeature({ feature, bp })
  stateModel.setCursor()
}

// False positive here, none of these functions use "this"
/* eslint-disable @typescript-eslint/unbound-method */
const {
  drawDragPreview,
  getContextMenuItemsForFeature,
  onMouseLeave,
  onMouseUp,
} = boxGlyph
/* eslint-enable @typescript-eslint/unbound-method */

export const geneGlyph: Glyph = {
  draw,
  drawDragPreview,
  drawHover,
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
