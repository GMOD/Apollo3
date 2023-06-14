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
    display: LinearApolloDisplayMouseEvents,
    overlayCtx: CanvasRenderingContext2D,
  ) {
    return
  }

  drawDragPreview(
    display: LinearApolloDisplayMouseEvents,
    ctx: CanvasRenderingContext2D,
  ) {
    return
  }

  /** @returns true if the current drag that is starting is valid */
  startDrag(
    display: LinearApolloDisplayMouseEvents,
    event: CanvasMouseEvent,
  ): boolean {
    return false
  }

  executeDrag(
    display: LinearApolloDisplayMouseEvents,
    event: CanvasMouseEvent,
  ): void {
    return
  }

  onMouseDown(
    display: LinearApolloDisplayMouseEvents,
    event: CanvasMouseEvent,
  ): void {
    return
  }

  onMouseMove(
    display: LinearApolloDisplayMouseEvents,
    event: CanvasMouseEvent,
  ): void {
    return
  }

  onMouseLeave(
    display: LinearApolloDisplayMouseEvents,
    event: CanvasMouseEvent,
  ): void {
    return
  }

  onMouseUp(
    display: LinearApolloDisplayMouseEvents,
    event: CanvasMouseEvent,
  ): void {
    return
  }

  onContextMenu(
    display: LinearApolloDisplayMouseEvents,
    event: CanvasMouseEvent,
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
      session,
    } = display
    const { feature: sourceFeature } = apolloHover || {}
    const { getRole } = internetAccount
    const role = getRole()
    const admin = role === 'admin'
    const readOnly = !Boolean(role && ['admin', 'user'].includes(role))
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
                selectedFeature: display.selectedFeature,
                setSelectedFeature: display.setSelectedFeature,
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
