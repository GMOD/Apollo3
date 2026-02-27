import type { AnnotationFeature } from '@apollo-annotation/mst'
import type { BaseDisplayModel } from '@jbrowse/core/pluggableElementTypes'
import type { MenuItem } from '@jbrowse/core/ui'
import {
  type AbstractSessionModel,
  getContainingView,
} from '@jbrowse/core/util'
import type { ContentBlock } from '@jbrowse/core/util/blockTypes'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

import { MergeExons, SplitExon } from '../../components'
import {
  getAdjacentExons,
  getStreamIcon,
  isSelectedFeature,
  navToFeatureCenter,
  selectFeatureAndOpenWidget,
} from '../../util'
import type { LinearApolloDisplay } from '../stateModel'

import { boxGlyph } from './BoxGlyph'
import type { Glyph } from './Glyph'
import { drawHighlight, getFeatureBox, strokeRectInner } from './util'

function draw(
  display: LinearApolloDisplay,
  ctx: CanvasRenderingContext2D,
  exon: AnnotationFeature,
  row: number,
  rowInFeature: number,
  block: ContentBlock,
) {
  const { apolloRowHeight, canvasPatterns, selectedFeature, theme } = display
  const [, left, width] = getFeatureBox(display, exon, row, block)
  const height = Math.round(0.6 * apolloRowHeight)
  const halfHeight = Math.round(height / 2)
  const top = Math.round(halfHeight / 2) + row * apolloRowHeight
  if (width > 2) {
    ctx.fillStyle = 'rgb(211,211,211)'
    ctx.fillRect(left, top, width, height)
    const forwardFill = canvasPatterns.forward
    const backwardFill = canvasPatterns.backward
    const { strand } = exon
    if (forwardFill && backwardFill && strand) {
      const { reversed } = block
      const reversal = reversed ? -1 : 1
      const [topFill, bottomFill] =
        strand * reversal === 1
          ? [forwardFill, backwardFill]
          : [backwardFill, forwardFill]
      ctx.fillStyle = topFill
      ctx.fillRect(left, top, width, halfHeight)
      ctx.fillStyle = bottomFill
      ctx.fillRect(left, top + halfHeight, width, halfHeight)
    }
  }
  strokeRectInner(ctx, left, top, width, height, theme.palette.text.primary)
  if (isSelectedFeature(exon, selectedFeature)) {
    drawHighlight(display, ctx, left, top, width, height, true)
  }
}

function drawHover(
  display: LinearApolloDisplay,
  overlayCtx: CanvasRenderingContext2D,
  exon: AnnotationFeature,
  row: number,
  block: ContentBlock,
) {
  const { apolloRowHeight } = display
  const [, left, width] = getFeatureBox(display, exon, row, block)
  const height = Math.round(0.6 * apolloRowHeight)
  const halfHeight = Math.round(height / 2)
  const top = Math.round(halfHeight / 2) + row * apolloRowHeight
  drawHighlight(display, overlayCtx, left, top, width, height)
}

function getLayout(display: LinearApolloDisplay, feature: AnnotationFeature) {
  return {
    byFeature: new Map([[feature._id, 0]]),
    byRow: [[{ feature, rowInFeature: 0 }]],
    min: feature.min,
    max: feature.max,
  }
}

function getContextMenuItems(
  display: LinearApolloDisplay,
  feature: AnnotationFeature,
): MenuItem[] {
  const {
    apolloInternetAccount: internetAccount,
    changeManager,
    regions,
    selectedFeature,
    session,
  } = display
  const [region] = regions
  const currentAssemblyId = display.getAssemblyId(region.assemblyName)
  const role = internetAccount ? internetAccount.role : 'admin'
  const admin = role === 'admin'
  const menuItems: MenuItem[] = []
  const adjacentExons = getAdjacentExons(feature, display)
  const lgv = getContainingView(
    display as BaseDisplayModel,
  ) as unknown as LinearGenomeViewModel
  if (adjacentExons.upstream) {
    const exon = adjacentExons.upstream
    menuItems.push({
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
    menuItems.push({
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
  menuItems.push(
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
  return menuItems
}

// False positive here, none of these functions use "this"
/* eslint-disable @typescript-eslint/unbound-method */
const { drawDragPreview } = boxGlyph
/* eslint-enable @typescript-eslint/unbound-method */

export const exonGlyph: Glyph = {
  draw,
  drawDragPreview,
  drawHover,
  getContextMenuItems,
  getLayout,
  isDraggable: true,
}
