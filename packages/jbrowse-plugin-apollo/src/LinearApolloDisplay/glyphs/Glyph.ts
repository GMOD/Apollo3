/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { AnnotationFeatureNew } from '@apollo-annotation/mst'
import { MenuItem } from '@jbrowse/core/ui'
import { AbstractSessionModel, SessionWithWidgets } from '@jbrowse/core/util'
import { alpha } from '@mui/material'

import {
  AddChildFeature,
  CopyFeature,
  DeleteFeature,
  ModifyFeatureAttribute,
} from '../../components'
import {
  LinearApolloDisplayMouseEvents,
  MousePosition,
} from '../stateModel/mouseEvents'
import { LinearApolloDisplayRendering } from '../stateModel/rendering'
import { CanvasMouseEvent } from '../types'

export abstract class Glyph {
  /** @returns number of layout rows used by this glyph with this feature and zoom level */
  abstract getRowCount(feature: AnnotationFeatureNew, bpPerPx: number): number

  /** draw the feature's primary rendering on the canvas */
  abstract draw(
    display: LinearApolloDisplayRendering,
    ctx: CanvasRenderingContext2D,
    feature: AnnotationFeatureNew,
    xOffset: number,
    row: number,
    reversed: boolean,
  ): void

  /** @returns the feature or subfeature at the given bp and row number in this glyph's layout */
  abstract getFeatureFromLayout(
    feature: AnnotationFeatureNew,
    bp: number,
    row: number,
  ): AnnotationFeatureNew | undefined

  abstract getRowForFeature(
    feature: AnnotationFeatureNew,
    childFeature: AnnotationFeatureNew,
  ): number | undefined

  abstract continueDrag(
    display: LinearApolloDisplayRendering,
    currentMousePosition: MousePosition,
  ): void

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
    const { apolloHover, apolloRowHeight, displayedRegions, lgv, theme } =
      display
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

    let location = 'Loc: '
    const { length, max, min } = feature
    location += `${min + 1}–${max}`

    let startPx =
      (bpToPx({ refName, coord: reversed ? max : min, regionNumber })
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
    context.fillStyle = alpha(
      theme?.palette.text.primary ?? 'rgb(1, 1, 1)',
      0.7,
    )
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
    context.fillStyle =
      theme?.palette.background.default ?? 'rgba(255, 255, 255)'
    let textTop = top + 12
    context.fillText(featureType, startPx + 2, textTop)
    if (featureName) {
      textTop = textTop + 12
      context.fillText(`Name: ${featureName}`, startPx + 2, textTop)
    }
    textTop = textTop + 12
    context.fillText(location, startPx + 2, textTop)
  }

  getAdjacentFeatures(
    feature?: AnnotationFeatureNew,
    parentFeature?: AnnotationFeatureNew,
  ): {
    prevFeature?: AnnotationFeatureNew
    nextFeature?: AnnotationFeatureNew
  } {
    let prevFeature: AnnotationFeatureNew | undefined
    let nextFeature: AnnotationFeatureNew | undefined
    let i = 0
    if (!feature || !parentFeature?.children) {
      return { prevFeature, nextFeature }
    }
    for (const [, f] of parentFeature.children) {
      if (f._id === feature._id) {
        break
      }
      i++
    }
    const keys = [...parentFeature.children.keys()]
    if (i > 0) {
      const key = keys[i - 1]
      prevFeature = parentFeature.children.get(key)
    }
    if (i < keys.length - 1) {
      const key = keys[i + 1]
      nextFeature = parentFeature.children.get(key)
    }
    return { prevFeature, nextFeature }
  }

  getParentFeature(
    feature?: AnnotationFeatureNew,
    topLevelFeature?: AnnotationFeatureNew,
  ) {
    let parentFeature

    if (!feature || !topLevelFeature?.children) {
      return parentFeature
    }

    for (const [, f] of topLevelFeature.children) {
      if (f._id === feature._id) {
        parentFeature = topLevelFeature
        break
      }
      if (!f?.children) {
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
    const role = internetAccount ? internetAccount.role : 'admin'
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
                  setSelectedFeature,
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
    }
    return menuItems
  }
}
