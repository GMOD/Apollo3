/* eslint-disable @typescript-eslint/unbound-method */

/* eslint-disable @typescript-eslint/no-misused-promises */

import { Menu, type MenuItem } from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import LockIcon from '@mui/icons-material/Lock'
import { Alert, CircularProgress, Tooltip, useTheme } from '@mui/material'
import { observer } from 'mobx-react'
import React, { useEffect, useState } from 'react'

import { type Coord, useStyles } from '../../util/displayUtils'
import type { LinearApolloDisplay as LinearApolloDisplayI } from '../stateModel'

import { CheckResultWarnings } from './CheckResultWarnings'
import { Tooltip as LinearApolloDisplayTooltip } from './Tooltip'

interface LinearApolloDisplayProps {
  model: LinearApolloDisplayI
}

// Lock icon when isLocked === true

export const LinearApolloDisplay = observer(function LinearApolloDisplay(
  props: LinearApolloDisplayProps,
) {
  const theme = useTheme()
  const { model } = props
  const {
    loading,
    contextMenuItems: getContextMenuItems,
    cursor,
    featuresHeight,
    isShown,
    onMouseDown,
    onMouseLeave,
    onMouseMove,
    onMouseUp,
    regionCannotBeRendered,
    session,
    setCanvas,
    setCollaboratorCanvas,
    setOverlayCanvas,
    setTheme,
  } = model
  const { classes } = useStyles()
  const lgv = getContainingView(model) as unknown as LinearGenomeViewModel

  useEffect(() => {
    setTheme(theme)
  }, [theme, setTheme])
  const [contextCoord, setContextCoord] = useState<Coord>()
  const [contextMenuItems, setContextMenuItems] = useState<MenuItem[]>([])
  const [mouseCoord, setMouseCoord] = useState<Coord>()
  const message = regionCannotBeRendered()
  if (!isShown) {
    return null
  }
  return (
    <>
      <div
        className={classes.canvasContainer}
        style={{
          width: lgv.dynamicBlocks.totalWidthPx,
          height: featuresHeight,
        }}
        onContextMenu={(event) => {
          event.preventDefault()
          if (contextMenuItems.length > 0) {
            // There's already a context menu open, so close it
            setContextMenuItems([])
          } else {
            const coord: [number, number] = [event.clientX, event.clientY]
            setContextCoord(coord)
            setContextMenuItems(getContextMenuItems(event))
          }
        }}
        onMouseMove={(event) => {
          setMouseCoord([event.clientX, event.clientY])
        }}
        onMouseLeave={() => {
          setMouseCoord(undefined)
        }}
      >
        {session.isLocked ? (
          <div className={classes.locked} data-testid="lock-icon">
            <LockIcon />
          </div>
        ) : null}
        {loading ? (
          <div className={classes.loading}>
            <CircularProgress size="18px" />
          </div>
        ) : null}
        {/* This type is wrong in @jbrowse/core */}
        {/* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition */}
        {message ? (
          <Alert
            severity="warning"
            classes={{ message: classes.ellipses }}
            slotProps={{ root: { className: classes.center } }}
          >
            <Tooltip title={message}>
              <div>{message}</div>
            </Tooltip>
          </Alert>
        ) : (
          // Promise.resolve() in these 3 callbacks is to avoid infinite rendering loop
          // https://github.com/mobxjs/mobx/issues/3728#issuecomment-1715400931
          <>
            <canvas
              ref={async (node: HTMLCanvasElement) => {
                await Promise.resolve()
                setCollaboratorCanvas(node)
              }}
              width={lgv.dynamicBlocks.totalWidthPx}
              height={featuresHeight}
              className={classes.canvas}
              data-testid="collaboratorCanvas"
            />
            <canvas
              ref={async (node: HTMLCanvasElement) => {
                await Promise.resolve()
                setCanvas(node)
              }}
              width={lgv.dynamicBlocks.totalWidthPx}
              height={featuresHeight}
              className={classes.canvas}
              data-testid="canvas"
            />
            <canvas
              ref={async (node: HTMLCanvasElement) => {
                await Promise.resolve()
                setOverlayCanvas(node)
              }}
              width={lgv.dynamicBlocks.totalWidthPx}
              height={featuresHeight}
              onMouseMove={onMouseMove}
              onMouseLeave={onMouseLeave}
              onMouseDown={onMouseDown}
              onMouseUp={onMouseUp}
              className={classes.canvas}
              style={{ cursor: cursor ?? 'default' }}
              data-testid="overlayCanvas"
            />
            <CheckResultWarnings display={model} />
            <Menu
              open={contextMenuItems.length > 0}
              onMenuItemClick={(_, callback) => {
                callback()
                setContextMenuItems([])
              }}
              onClose={() => {
                setContextMenuItems([])
              }}
              slotProps={{
                transition: {
                  onExit: () => {
                    setContextMenuItems([])
                  },
                },
              }}
              anchorReference="anchorPosition"
              anchorPosition={
                contextCoord
                  ? { top: contextCoord[1], left: contextCoord[0] }
                  : undefined
              }
              menuItems={contextMenuItems}
            />
          </>
        )}
      </div>
      <LinearApolloDisplayTooltip
        mouseCooordinate={mouseCoord}
        session={session}
      />
    </>
  )
})
