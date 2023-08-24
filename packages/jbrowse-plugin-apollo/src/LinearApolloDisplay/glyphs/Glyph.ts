import { MenuItem } from '@jbrowse/core/ui'
import { AnnotationFeatureI } from 'apollo-mst'

import {
  AddFeature,
  CopyFeature,
  DeleteFeature,
  ModifyFeatureAttribute,
} from '../../components'
import { LinearApolloDisplayMouseEvents } from '../stateModel/mouseEvents'
import { LinearApolloDisplayRendering } from '../stateModel/rendering'
import { CanvasMouseEvent } from '../types'

export abstract class Glyph {
  /** @returns number of layout rows used by this glyph with this feature and zoom level */
  abstract getRowCount(feature: AnnotationFeatureI, bpPerPx: number): number

  /** draw the feature's primary rendering on the canvas */
  abstract draw(
    display: LinearApolloDisplayRendering,
    ctx: CanvasRenderingContext2D,
    feature: AnnotationFeatureI,
    xOffset: number,
    row: number,
    reversed: boolean,
  ): void

  /** @returns the feature or subfeature at the given bp and row number in this glyph's layout */
  abstract getFeatureFromLayout(
    feature: AnnotationFeatureI,
    bp: number,
    row: number,
  ): AnnotationFeatureI | undefined

  drawHover(
    _display: LinearApolloDisplayMouseEvents,
    _overlayCtx: CanvasRenderingContext2D,
    _rowNum?: number,
    _xOffset?: number,
    _reversed?: boolean,
  ) {
    return
  }

  drawDragPreview(
    _display: LinearApolloDisplayMouseEvents,
    _ctx: CanvasRenderingContext2D,
  ) {
    return
  }

  /** @returns true if the current drag that is starting is valid */
  startDrag(
    _display: LinearApolloDisplayMouseEvents,
    _event: CanvasMouseEvent,
  ): boolean {
    return false
  }

  executeDrag(
    _display: LinearApolloDisplayMouseEvents,
    _event: CanvasMouseEvent,
  ): void {
    return
  }

  onMouseDown(
    _display: LinearApolloDisplayMouseEvents,
    _event: CanvasMouseEvent,
  ): void {
    return
  }

  onMouseMove(
    _display: LinearApolloDisplayMouseEvents,
    _event: CanvasMouseEvent,
  ): void {
    return
  }

  onMouseLeave(
    _display: LinearApolloDisplayMouseEvents,
    _event: CanvasMouseEvent,
  ): void {
    return
  }

  onMouseUp(
    _display: LinearApolloDisplayMouseEvents,
    _event: CanvasMouseEvent,
  ): void {
    return
  }

  onContextMenu(
    _display: LinearApolloDisplayMouseEvents,
    _event: CanvasMouseEvent,
  ): void {
    return
  }

  drawTooltip(
    display: LinearApolloDisplayMouseEvents,
    context: CanvasRenderingContext2D,
  ): void {
    const { apolloHover, apolloRowHeight, displayedRegions, lgv } = display
    if (!apolloHover) {
      return
    }
    const { feature, mousePosition } = apolloHover
    if (!(feature && mousePosition)) {
      return
    }
    const { regionNumber, y } = mousePosition
    const displayedRegion = displayedRegions[regionNumber]
    const { refName, reversed } = displayedRegion
    const { bpPerPx, bpToPx, offsetPx } = lgv

    const { discontinuousLocations } = feature
    let start: number, end: number, length: number
    let location = 'Loc: '
    if (discontinuousLocations && discontinuousLocations.length > 0) {
      const lastLoc = discontinuousLocations.at(-1)
      if (!lastLoc) {
        return
      }
      start = lastLoc?.start
      end = lastLoc?.end
      length = lastLoc?.end - lastLoc?.start

      for (const [i, loc] of discontinuousLocations.entries()) {
        location += `${loc.start.toString()}-${loc.end.toString()}`
        if (i !== discontinuousLocations.length - 1) {
          location += ','
        }
      }
    } else {
      ;({ end, length, start } = feature)
      location += `${start.toString()}-${end.toString()}`
    }

    let startPx =
      (bpToPx({ refName, coord: reversed ? end : start, regionNumber })
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
    context.fillStyle = 'rgba(1, 1, 1, 0.7)'
    context.fillRect(
      startPx,
      top,
      maxWidth + 4,
      textWidth.length === 3 ? 45 : 35,
    )
    context.beginPath()
    context.moveTo(startPx, top)
    context.lineTo(startPx - 5, top + 5)
    context.lineTo(startPx, top + 10)
    context.fill()
    context.fillStyle = 'rgba(255, 255, 255)'
    let textTop = top + 12
    context.fillText(featureType, startPx + 2, textTop)
    if (featureName) {
      textTop = textTop + 12
      context.fillText(`Name: ${featureName}`, startPx + 2, textTop)
    }
    textTop = textTop + 12
    context.fillText(location, startPx + 2, textTop)
  }

  getContextMenuItems(display: LinearApolloDisplayMouseEvents): MenuItem[] {
    const {
      apolloHover,
      apolloInternetAccount: internetAccount,
      changeManager,
      getAssemblyId,
      regions,
      selectedFeature,
      session,
      setSelectedFeature,
    } = display
    const { feature: sourceFeature } = apolloHover ?? {}
    const { getRole } = internetAccount
    const role = getRole()
    const admin = role === 'admin'
    const readOnly = !(role && ['admin', 'user'].includes(role))
    const menuItems: MenuItem[] = []
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
                },
                changeManager,
                sourceFeature,
                sourceAssemblyId,
                internetAccount,
              },
            ])
          },
        },
        {
          label: 'Copy features and annotations',
          disabled: readOnly,
          onClick: () => {
            session.queueDialog((doneCallback) => [
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
            ])
          },
        },
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
                },
                changeManager,
                sourceFeature,
                sourceAssemblyId: currentAssemblyId,
                selectedFeature,
                setSelectedFeature,
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
