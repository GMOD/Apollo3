import { AnnotationFeature } from '@apollo-annotation/mst'
import { Theme, alpha } from '@mui/material'
import { MenuItem } from '@jbrowse/core/ui'

import { AbstractSessionModel, SessionWithWidgets } from '@jbrowse/core/util'

import {
  AddChildFeature,
  CopyFeature,
  DeleteFeature,
  ModifyFeatureAttribute,
} from '../../components'

import { LinearApolloDisplay } from '../stateModel'
import {
  isMousePositionWithFeatureAndGlyph,
  LinearApolloDisplayMouseEvents,
  MousePosition,
  MousePositionWithFeatureAndGlyph,
} from '../stateModel/mouseEvents'
import { CanvasMouseEvent } from '../types'
import { Glyph } from './Glyph'
import { LinearApolloDisplayRendering } from '../stateModel/rendering'

function getRowCount(_feature: AnnotationFeature) {
  return 1
}

function getIsSelectedFeature(
  feature: AnnotationFeature,
  selectedFeature: AnnotationFeature | undefined,
) {
  return Boolean(selectedFeature && feature._id === selectedFeature._id)
}

function getBackgroundColor(theme: Theme | undefined, selected: boolean) {
  return selected
    ? theme?.palette.text.primary ?? 'black'
    : theme?.palette.background.default ?? 'white'
}

function getTextColor(theme: Theme | undefined, selected: boolean) {
  return selected
    ? theme?.palette.getContrastText(getBackgroundColor(theme, selected)) ??
        'white'
    : theme?.palette.text.primary ?? 'black'
}

function drawBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
) {
  ctx.fillStyle = color
  ctx.fillRect(x, y, width, height)
}

function drawBoxOutline(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
) {
  drawBox(ctx, x, y, width, height, color)
  if (width <= 2) {
    return
  }
  ctx.clearRect(x + 1, y + 1, width - 2, height - 2)
}

function drawBoxFill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
) {
  drawBox(ctx, x + 1, y + 1, width - 2, height - 2, color)
}

function drawBoxText(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  color: string,
  text: string,
) {
  ctx.fillStyle = color
  const textStart = Math.max(x + 1, 0)
  const textWidth = x - 1 + width - textStart
  ctx.fillText(text, textStart, y + 11, textWidth)
}

function draw(
  ctx: CanvasRenderingContext2D,
  feature: AnnotationFeature,
  row: number,
  stateModel: LinearApolloDisplayRendering,
  displayedRegionIndex: number,
) {
  const { apolloRowHeight: heightPx, lgv, session, theme } = stateModel
  const { bpPerPx, displayedRegions, offsetPx } = lgv
  const displayedRegion = displayedRegions[displayedRegionIndex]
  const minX =
    (lgv.bpToPx({
      refName: displayedRegion.refName,
      coord: feature.min,
      regionNumber: displayedRegionIndex,
    })?.offsetPx ?? 0) - offsetPx
  const { reversed } = displayedRegion
  const { apolloSelectedFeature } = session
  const widthPx = feature.length / bpPerPx
  const startPx = reversed ? minX - widthPx : minX
  const top = row * heightPx
  const isSelected = getIsSelectedFeature(feature, apolloSelectedFeature)
  const backgroundColor = getBackgroundColor(theme, isSelected)
  const textColor = getTextColor(theme, isSelected)
  const featureBox: [number, number, number, number] = [
    startPx,
    top,
    widthPx,
    heightPx,
  ]
  drawBoxOutline(ctx, ...featureBox, textColor)
  if (widthPx <= 2) {
    // Don't need to add details if the feature is too small to see them
    return
  }

  drawBoxFill(ctx, startPx, top, widthPx, heightPx, backgroundColor)
  drawBoxText(ctx, startPx, top, widthPx, textColor, feature.type)
}

function getFeatureFromLayout(
  feature: AnnotationFeature,
  _bp: number,
  _row: number,
): AnnotationFeature {
  return feature
}

function getRowForFeature(
  _feature: AnnotationFeature,
  _childFeature: AnnotationFeature,
): number | undefined {
  return 0
}

/** @returns undefined if mouse not on the edge of this feature, otherwise 'start' or 'end' depending on which edge */
function isMouseOnFeatureEdge(
  mousePosition: MousePosition,
  feature: AnnotationFeature,
  stateModel: LinearApolloDisplay,
) {
  const { refName, regionNumber, x } = mousePosition
  const { lgv } = stateModel
  const { offsetPx } = lgv
  const startPxInfo = lgv.bpToPx({
    refName,
    coord: feature.min,
    regionNumber,
  })
  const endPxInfo = lgv.bpToPx({ refName, coord: feature.max, regionNumber })
  if (startPxInfo !== undefined && endPxInfo !== undefined) {
    const startPx = startPxInfo.offsetPx - offsetPx
    const endPx = endPxInfo.offsetPx - offsetPx
    if (Math.abs(endPx - startPx) < 8) {
      return
    }
    if (Math.abs(startPx - x) < 4) {
      return 'min'
    }
    if (Math.abs(endPx - x) < 4) {
      return 'max'
    }
  }
  return
}

function drawHover(
  stateModel: LinearApolloDisplay,
  ctx: CanvasRenderingContext2D,
) {
  const { apolloHover, apolloRowHeight, lgv, theme } = stateModel
  if (!apolloHover) {
    return
  }
  const { featureAndGlyphUnderMouse, regionNumber, y } = apolloHover
  const { bpPerPx, displayedRegions, offsetPx } = lgv
  const displayedRegion = displayedRegions[regionNumber]
  const { refName, reversed } = displayedRegion
  const { length, max, min } = featureAndGlyphUnderMouse.feature
  const startPx =
    (lgv.bpToPx({ refName, coord: reversed ? max : min, regionNumber })
      ?.offsetPx ?? 0) - offsetPx
  const row = Math.floor(y / apolloRowHeight)
  const top = row * apolloRowHeight
  const widthPx = length / bpPerPx
  ctx.fillStyle = theme?.palette.action.focus ?? 'rgba(0,0,0,0.04)'
  ctx.fillRect(startPx, top, widthPx, apolloRowHeight)
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
  const rowCount = getRowCount(feature)

  const featureEdgeBp = region.reversed
    ? region.end - feature[edge]
    : feature[edge] - region.start
  const featureEdgePx = featureEdgeBp / bpPerPx - offsetPx

  const rectX = Math.min(current.x, featureEdgePx)
  const rectY = row * apolloRowHeight
  const rectWidth = Math.abs(current.x - featureEdgePx)
  const rectHeight = apolloRowHeight * rowCount

  overlayCtx.strokeStyle = theme?.palette.info.main ?? 'rgb(255,0,0)'
  overlayCtx.setLineDash([6])
  overlayCtx.strokeRect(rectX, rectY, rectWidth, rectHeight)
  overlayCtx.fillStyle = alpha(theme?.palette.info.main ?? 'rgb(255,0,0)', 0.2)
  overlayCtx.fillRect(rectX, rectY, rectWidth, rectHeight)
}

function onMouseMove(
  stateModel: LinearApolloDisplay,
  mousePosition: MousePosition,
) {
  if (isMousePositionWithFeatureAndGlyph(mousePosition)) {
    const { featureAndGlyphUnderMouse } = mousePosition
    stateModel.setApolloHover(mousePosition)
    const { feature } = featureAndGlyphUnderMouse
    const edge = isMouseOnFeatureEdge(mousePosition, feature, stateModel)
    if (edge) {
      stateModel.setCursor('col-resize')
      return
    }
  }
  stateModel.setCursor()
}

function onMouseDown(
  stateModel: LinearApolloDisplay,
  currentMousePosition: MousePositionWithFeatureAndGlyph,
  event: CanvasMouseEvent,
) {
  const { featureAndGlyphUnderMouse } = currentMousePosition
  // swallow the mouseDown if we are on the edge of the feature so that we
  // don't start dragging the view if we try to drag the feature edge
  const { feature } = featureAndGlyphUnderMouse
  const edge = isMouseOnFeatureEdge(currentMousePosition, feature, stateModel)
  if (edge) {
    event.stopPropagation()
    stateModel.startDrag(currentMousePosition, feature, edge)
  }
}

function onMouseUp(
  stateModel: LinearApolloDisplay,
  mousePosition: MousePosition,
) {
  if (stateModel.apolloDragging) {
    return
  }
  const { featureAndGlyphUnderMouse } = mousePosition
  if (featureAndGlyphUnderMouse?.feature) {
    stateModel.setSelectedFeature(featureAndGlyphUnderMouse.feature)
  }
}

function onMouseLeave(): void {
  return
}

function getParentFeature(
  feature?: AnnotationFeature,
  topLevelFeature?: AnnotationFeature,
) {
  let parentFeature: AnnotationFeature | undefined
  if (!feature || !topLevelFeature?.children) {
    return parentFeature
  }

  for (const [, f] of topLevelFeature.children) {
    if (f._id === feature._id) {
      parentFeature = topLevelFeature
      break
    }
    if (!f.children) {
      continue
    }
    for (const [, cf] of f.children) {
      if (cf._id === feature._id) {
        parentFeature = f
        break
      }
    }
    if (parentFeature) {
      break
    }
  }
  return parentFeature
}

function drawTooltip(
  display: LinearApolloDisplayMouseEvents,
  context: CanvasRenderingContext2D,
): void {
  const { apolloHover, apolloRowHeight, lgv, theme } = display
  if (!apolloHover) {
    return
  }
  const { featureAndGlyphUnderMouse, regionNumber, y } = apolloHover
  const { feature } = featureAndGlyphUnderMouse
  const { bpPerPx, displayedRegions, offsetPx } = lgv
  const displayedRegion = displayedRegions[regionNumber]
  const { refName, reversed } = displayedRegion

  let location = 'Loc: '

  const { length, max, min } = feature
  location += `${min + 1}–${max}`

  let startPx =
    (lgv.bpToPx({ refName, coord: reversed ? max : min, regionNumber })
      ?.offsetPx ?? 0) - offsetPx
  const row = Math.floor(y / apolloRowHeight)
  const top = row * apolloRowHeight
  const widthPx = length / bpPerPx

  const featureType = `Type: ${feature.type}`
  const { attributes } = feature
  const featureName = attributes.get('gff_name')?.find((name) => name !== '')
  const textWidth = [
    context.measureText(featureType).width,
    context.measureText(location).width,
  ]
  if (featureName) {
    textWidth.push(context.measureText(`Name: ${featureName}`).width)
  }
  const maxWidth = Math.max(...textWidth)

  startPx = startPx + widthPx + 5
  context.fillStyle = alpha(theme?.palette.text.primary ?? 'rgb(1, 1, 1)', 0.7)
  context.fillRect(startPx, top, maxWidth + 4, textWidth.length === 3 ? 45 : 35)
  context.beginPath()
  context.moveTo(startPx, top)
  context.lineTo(startPx - 5, top + 5)
  context.lineTo(startPx, top + 10)
  context.fill()
  context.fillStyle = theme?.palette.background.default ?? 'rgba(255, 255, 255)'
  let textTop = top + 12
  context.fillText(featureType, startPx + 2, textTop)
  if (featureName) {
    textTop = textTop + 12
    context.fillText(`Name: ${featureName}`, startPx + 2, textTop)
  }
  textTop = textTop + 12
  context.fillText(location, startPx + 2, textTop)
}

function getContextMenuItems(
  display: LinearApolloDisplayMouseEvents,
): MenuItem[] {
  const {
    apolloHover,
    apolloInternetAccount: internetAccount,
    changeManager,
    regions,
    selectedFeature,
    session,
  } = display
  const menuItems: MenuItem[] = []
  if (!apolloHover) {
    return menuItems
  }
  const { featureAndGlyphUnderMouse } = apolloHover
  const { feature: sourceFeature } = featureAndGlyphUnderMouse
  const role = internetAccount ? internetAccount.role : 'admin'
  const admin = role === 'admin'
  const readOnly = !(role && ['admin', 'user'].includes(role))
  const [region] = regions
  const sourceAssemblyId = display.getAssemblyId(region.assemblyName)
  const currentAssemblyId = display.getAssemblyId(region.assemblyName)
  menuItems.push(
    {
      label: 'Add child feature',
      disabled: readOnly,
      onClick: () => {
        ;(session as unknown as AbstractSessionModel).queueDialog(
          (doneCallback) => [
            AddChildFeature,
            {
              session,
              handleClose: () => {
                doneCallback()
              },
              changeManager,
              sourceFeature,
              sourceAssemblyId,
              internetAccount,
            },
          ],
        )
      },
    },
    {
      label: 'Copy features and annotations',
      disabled: readOnly,
      onClick: () => {
        ;(session as unknown as AbstractSessionModel).queueDialog(
          (doneCallback) => [
            CopyFeature,
            {
              session,
              handleClose: () => {
                doneCallback()
              },
              changeManager,
              sourceFeature,
              sourceAssemblyId: currentAssemblyId,
            },
          ],
        )
      },
    },
    {
      label: 'Delete feature',
      disabled: !admin,
      onClick: () => {
        ;(session as unknown as AbstractSessionModel).queueDialog(
          (doneCallback) => [
            DeleteFeature,
            {
              session,
              handleClose: () => {
                doneCallback()
              },
              changeManager,
              sourceFeature,
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
      label: 'Modify feature attribute',
      disabled: readOnly,
      onClick: () => {
        ;(session as unknown as AbstractSessionModel).queueDialog(
          (doneCallback) => [
            ModifyFeatureAttribute,
            {
              session,
              handleClose: () => {
                doneCallback()
              },
              changeManager,
              sourceFeature,
              sourceAssemblyId: currentAssemblyId,
            },
          ],
        )
      },
    },
    {
      label: 'Edit feature details',
      onClick: () => {
        const apolloFeatureWidget = (
          session as unknown as SessionWithWidgets
        ).addWidget(
          'ApolloFeatureDetailsWidget',
          'apolloFeatureDetailsWidget',
          {
            feature: sourceFeature,
            assembly: currentAssemblyId,
            refName: region.refName,
          },
        )
        ;(session as unknown as SessionWithWidgets).showWidget(
          apolloFeatureWidget,
        )
      },
    },
  )
  return menuItems
}

export const boxGlyph: Glyph = {
  getRowCount,
  draw,
  getFeatureFromLayout,
  getRowForFeature,
  drawHover,
  drawDragPreview,
  onMouseDown,
  onMouseMove,
  onMouseLeave,
  onMouseUp,
  getParentFeature,
  drawTooltip,
  getContextMenuItems,
}
