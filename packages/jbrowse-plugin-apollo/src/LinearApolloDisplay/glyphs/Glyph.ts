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

  abstract drawTooltip(
    display: LinearApolloDisplayMouseEvents,
    context: CanvasRenderingContext2D,
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
