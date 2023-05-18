import { MenuItem } from '@jbrowse/core/ui'
import { alpha } from '@mui/material'
import { AnnotationFeatureI } from 'apollo-mst'
import { LocationEndChange, LocationStartChange } from 'apollo-shared'

import {
  AddFeature,
  DeleteFeature,
  ModifyFeatureAttribute,
} from '../../components'
import { LinearApolloDisplay } from '../stateModel'
import { MousePosition } from '../stateModel/mouseEvents'
import { CanvasMouseEvent } from '../types'
import { Glyph } from './Glyph'

export class BoxGlyph extends Glyph {
  getRowCount(feature: AnnotationFeatureI, bpPerPx: number) {
    return 1
  }

  draw(
    stateModel: LinearApolloDisplay,
    ctx: CanvasRenderingContext2D,
    feature: AnnotationFeatureI,
    x: number,
    y: number,
    reversed: boolean,
  ) {
    const width = feature.end - feature.start
    const { bpPerPx } = stateModel.lgv
    const widthPx = width / bpPerPx
    const startBp = reversed
      ? feature.max - feature.end
      : feature.start - feature.min
    const startPx = startBp / bpPerPx
    const rowHeight = stateModel.apolloRowHeight
    ctx.fillStyle = stateModel.theme?.palette.text.primary || 'black'
    ctx.fillRect(x + startPx, y, widthPx, rowHeight)
    if (widthPx > 2) {
      ctx.clearRect(x + startPx + 1, y + 1, widthPx - 2, rowHeight - 2)
      ctx.fillStyle = stateModel.theme?.palette.background.default || 'white'
      ctx.fillRect(x + startPx + 1, y + 1, widthPx - 2, rowHeight - 2)
      ctx.fillStyle = stateModel.theme?.palette.text.primary || 'black'
      feature.type &&
        ctx.fillText(feature.type, x + startPx + 1, y + 11, widthPx - 2)
    }
  }

  getFeatureFromLayout(feature: AnnotationFeatureI, _bp: number, _row: number) {
    return feature
  }

  /** @returns undefined if mouse not on the edge of this feature, otherwise 'start' or 'end' depending on which edge */
  isMouseOnFeatureEdge(
    mousePosition: MousePosition,
    feature: AnnotationFeatureI,
    stateModel: LinearApolloDisplay,
  ) {
    if (!mousePosition) {
      return
    }
    const { x, regionNumber, refName } = mousePosition
    // TODO: check reversed
    // TODO: ensure feature is in interbase
    const startPxInfo = stateModel.lgv.bpToPx({
      refName,
      coord: feature.start,
      regionNumber,
    })
    const endPxInfo = stateModel.lgv.bpToPx({
      refName,
      coord: feature.end,
      regionNumber,
    })
    if (startPxInfo !== undefined && endPxInfo !== undefined) {
      const startPx = startPxInfo.offsetPx - stateModel.lgv.offsetPx
      const endPx = endPxInfo.offsetPx - stateModel.lgv.offsetPx
      if (endPx - startPx < 8) {
        return
      }
      if (Math.abs(startPx - x) < 4) {
        return 'start'
      }
      if (Math.abs(endPx - x) < 4) {
        return 'end'
      }
    }
    return undefined
  }

  drawHover(stateModel: LinearApolloDisplay, ctx: CanvasRenderingContext2D) {
    const hover = stateModel.apolloHover
    if (!hover) {
      return
    }
    const { feature, mousePosition } = hover
    if (!feature) {
      return
    }
    const { bpPerPx } = stateModel.lgv
    const rowHeight = stateModel.apolloRowHeight
    const displayedRegion =
      stateModel.displayedRegions[mousePosition.regionNumber]

    const x =
      (stateModel.lgv.bpToPx({
        refName: displayedRegion.refName,
        coord: feature.min,
        regionNumber: mousePosition.regionNumber,
      })?.offsetPx || 0) - stateModel.lgv.offsetPx
    const row = Math.floor(mousePosition.y / rowHeight)
    const y = row * rowHeight

    const width = feature.end - feature.start
    const widthPx = width / bpPerPx
    const startBp = displayedRegion.reversed
      ? feature.max - feature.end
      : feature.start - feature.min
    const startPx = startBp / bpPerPx
    ctx.fillStyle = stateModel.theme?.palette.action.focus || 'rgba(0,0,0,0.04)'
    ctx.fillRect(x + startPx, y, widthPx, rowHeight)
  }

  drawDragPreview(
    stateModel: LinearApolloDisplay,
    overlayCtx: CanvasRenderingContext2D,
  ) {
    const { apolloDragging: dragging } = stateModel
    if (!dragging) {
      return
    }
    const {
      feature,
      glyph,
      mousePosition: startingMousePosition,
    } = dragging.start
    if (!feature) {
      throw new Error('no feature for drag preview??')
    }
    if (glyph !== this) {
      throw new Error('drawDragPreview() called on wrong glyph?')
    }
    const { mousePosition: currentMousePosition } = dragging.current
    const edge = this.isMouseOnFeatureEdge(
      startingMousePosition,
      feature,
      stateModel,
    )
    if (!edge) {
      return
    }

    const row = Math.floor(startingMousePosition.y / stateModel.apolloRowHeight)
    const region =
      stateModel.displayedRegions[startingMousePosition.regionNumber]
    const rowCount = this.getRowCount(feature, stateModel.lgv.bpPerPx)

    const featureEdgeBp = region.reversed
      ? region.end - feature[edge]
      : feature[edge] - region.start
    const featureEdgePx =
      featureEdgeBp / stateModel.lgv.bpPerPx - stateModel.lgv.offsetPx

    const rectX = Math.min(currentMousePosition.x, featureEdgePx)
    const rectY = row * stateModel.apolloRowHeight
    const rectWidth = Math.abs(currentMousePosition.x - featureEdgePx)
    const rectHeight = stateModel.apolloRowHeight * rowCount

    overlayCtx.strokeStyle =
      stateModel.theme?.palette.info.main || 'rgb(255,0,0)'
    overlayCtx.setLineDash([6])
    overlayCtx.strokeRect(rectX, rectY, rectWidth, rectHeight)
    overlayCtx.fillStyle = alpha(
      stateModel.theme?.palette.info.main || 'rgb(255,0,0)',
      0.2,
    )
    overlayCtx.fillRect(rectX, rectY, rectWidth, rectHeight)
  }

  onMouseMove(stateModel: LinearApolloDisplay, event: CanvasMouseEvent) {
    const { feature, mousePosition } =
      stateModel.getFeatureAndGlyphUnderMouse(event)
    if (stateModel.apolloDragging) {
      stateModel.setCursor('col-resize')
      return
    }
    if (feature && mousePosition) {
      const edge = this.isMouseOnFeatureEdge(mousePosition, feature, stateModel)
      if (edge) {
        stateModel.setCursor('col-resize')
      } else {
        stateModel.setCursor(undefined)
      }
    }
  }

  onMouseDown(stateModel: LinearApolloDisplay, event: CanvasMouseEvent) {
    // swallow the mouseDown if we are on the edge of the feature
    const { feature, mousePosition } =
      stateModel.getFeatureAndGlyphUnderMouse(event)
    if (feature && mousePosition) {
      const edge = this.isMouseOnFeatureEdge(mousePosition, feature, stateModel)
      if (edge) {
        event.stopPropagation()
      }
    }
  }

  onMouseUp(stateModel: LinearApolloDisplay, event: CanvasMouseEvent) {
    if (stateModel.apolloDragging) {
      return
    }
    const { feature } = stateModel.getFeatureAndGlyphUnderMouse(event)
    if (feature) {
      stateModel.setSelectedFeature(feature)
    }
  }

  startDrag(stateModel: LinearApolloDisplay, event: CanvasMouseEvent): boolean {
    // only accept the drag if we are on the edge of the feature
    const { mousePosition, feature } = stateModel.apolloDragging?.start || {}
    if (feature && mousePosition) {
      const edge = this.isMouseOnFeatureEdge(mousePosition, feature, stateModel)
      if (edge) {
        return true
      }
    }
    return false
  }

  executeDrag(stateModel: LinearApolloDisplay) {
    const { apolloDragging: dragging } = stateModel
    if (!dragging) {
      return
    }
    const {
      feature,
      glyph,
      mousePosition: startingMousePosition,
    } = dragging.start
    if (!feature) {
      throw new Error('no feature for drag preview??')
    }
    if (glyph !== this) {
      throw new Error('drawDragPreview() called on wrong glyph?')
    }
    const { mousePosition: currentMousePosition } = dragging.current
    const edge = this.isMouseOnFeatureEdge(
      startingMousePosition,
      feature,
      stateModel,
    )
    if (!edge) {
      return
    }

    const region =
      stateModel.displayedRegions[startingMousePosition.regionNumber]
    const featureEdgeBp = region.reversed
      ? region.end - feature[edge]
      : feature[edge] - region.start
    const featureEdgePx =
      featureEdgeBp / stateModel.lgv.bpPerPx - stateModel.lgv.offsetPx

    const newBp = Math.round(
      featureEdgeBp +
        (currentMousePosition.x - featureEdgePx) * stateModel.lgv.bpPerPx,
    )
    const assembly = stateModel.getAssemblyId(region.assemblyName)
    let change: LocationEndChange | LocationStartChange
    if (edge === 'end') {
      const featureId = feature._id
      const oldEnd = feature.end
      const newEnd = newBp
      change = new LocationEndChange({
        typeName: 'LocationEndChange',
        changedIds: [featureId],
        featureId,
        oldEnd,
        newEnd,
        assembly,
      })
    } else {
      const featureId = feature._id
      const oldStart = feature.start
      const newStart = newBp
      change = new LocationStartChange({
        typeName: 'LocationStartChange',
        changedIds: [featureId],
        featureId,
        oldStart,
        newStart,
        assembly,
      })
    }
    if (!stateModel.changeManager) {
      throw new Error('no change manager')
    }
    stateModel.changeManager.submit(change)
    stateModel.setCursor(undefined)
  }

  getContextMenuItems(stateModel: LinearApolloDisplay): MenuItem[] {
    const { getRole } = stateModel.apolloInternetAccount
    const role = getRole()
    const admin = role === 'admin'
    const readOnly = !Boolean(role && ['admin', 'user'].includes(role))
    const menuItems: MenuItem[] = []
    const {
      apolloContextMenuFeature: sourceFeature,
      apolloInternetAccount: internetAccount,
      changeManager,
      getAssemblyId,
      session,
      regions,
    } = stateModel
    if (sourceFeature) {
      const [region] = regions
      const sourceAssemblyId = getAssemblyId(region.assemblyName)
      const currentAssemblyId = getAssemblyId(region.assemblyName)
      menuItems.push(
        {
          label: 'Add child feature',
          disabled: readOnly,
          onClick: () => {
            session.queueDialog((doneCallback) => [
              AddFeature,
              {
                session,
                handleClose: () => {
                  doneCallback()
                  stateModel.setApolloContextMenuFeature(undefined)
                },
                changeManager,
                sourceFeature,
                sourceAssemblyId,
                internetAccount,
              },
            ])
          },
        },
        // {
        //   label: 'Copy features and annotations',
        //   disabled: isReadOnly,
        //   onClick: () => {
        //     const currentAssemblyId = getAssemblyId(region.assemblyName)
        //     session.queueDialog((doneCallback) => [
        //       CopyFeature,
        //       {
        //         session,
        //         handleClose: () => {
        //           doneCallback()
        //           setApolloContextMenuFeature(undefined)
        //         },
        //         changeManager,
        //         sourceFeatureId: contextMenuFeature?._id,
        //         sourceAssemblyId: currentAssemblyId,
        //       },
        //     ])
        //   },
        // },
        {
          label: 'Delete feature',
          disabled: !admin,
          onClick: () => {
            session.queueDialog((doneCallback) => [
              DeleteFeature,
              {
                session,
                handleClose: () => {
                  doneCallback()
                  stateModel.setApolloContextMenuFeature(undefined)
                },
                changeManager,
                sourceFeature,
                sourceAssemblyId: currentAssemblyId,
                selectedFeature: stateModel.selectedFeature,
                setSelectedFeature: stateModel.setSelectedFeature,
              },
            ])
          },
        },
        {
          label: 'Modify feature attribute',
          disabled: readOnly,
          onClick: () => {
            session.queueDialog((doneCallback) => [
              ModifyFeatureAttribute,
              {
                session,
                handleClose: () => {
                  doneCallback()
                  stateModel.setApolloContextMenuFeature(undefined)
                },
                changeManager,
                sourceFeature,
                sourceAssemblyId: currentAssemblyId,
              },
            ])
          },
        },
      )
    }
    return menuItems
  }
}
