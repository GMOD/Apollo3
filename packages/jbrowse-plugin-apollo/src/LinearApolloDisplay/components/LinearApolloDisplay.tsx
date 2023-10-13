import { Menu, MenuItem } from '@jbrowse/core/ui'
import LoadingEllipses from '@jbrowse/core/ui/LoadingEllipses'
import { getContainingView, getSession } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { Alert, Tooltip, useTheme } from '@mui/material'
import { observer } from 'mobx-react'
import React, { useEffect, useState } from 'react'
import { makeStyles } from 'tss-react/mui'

import { ApolloSessionModel } from '../../session'
import { LinearApolloDisplay as LinearApolloDisplayI } from '../stateModel'

interface LinearApolloDisplayProps {
  model: LinearApolloDisplayI
}
export type Coord = [number, number]

const useStyles = makeStyles()((theme) => ({
  canvasContainer: {
    position: 'relative',
    left: 0,
  },
  canvas: {
    position: 'absolute',
    left: 0,
  },
  ellipses: {
    textOverflow: 'ellipsis',
    overflow: 'hidden',
  },
  loading: {
    backgroundColor: theme.palette.background.default,
    backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 5px, ${theme.palette.action.disabledBackground} 5px, ${theme.palette.action.disabledBackground} 10px)`,
    position: 'absolute',
    height: 50,
    width: 300,
    right: 0,
    zIndex: 10,
    pointerEvents: 'none',
    textAlign: 'center',
  },
}))

export const LinearApolloDisplay = observer(function LinearApolloDisplay(
  props: LinearApolloDisplayProps,
) {
  const theme = useTheme()
  const { model } = props
  const {
    contextMenuItems: getContextMenuItems,
    cursor,
    featuresHeight,
    isShown,
    onMouseDown,
    onMouseLeave,
    onMouseMove,
    onMouseUp,
    regionCannotBeRendered,
    setCanvas,
    setCollaboratorCanvas,
    setOverlayCanvas,
    setTheme,
    tabularEditor,
  } = model
  const { classes } = useStyles()
  const lgv = getContainingView(model) as unknown as LinearGenomeViewModel

  useEffect(() => setTheme(theme), [theme, setTheme])
  const [contextCoord, setContextCoord] = useState<Coord>()
  const [contextMenuItems, setContextMenuItems] = useState<MenuItem[]>([])
  const { loadingRegions } = (
    getSession(model) as unknown as ApolloSessionModel
  ).apolloDataStore
  const message = regionCannotBeRendered()

  if (!isShown) {
    return null
  }

  return (
    <div
      className={classes.canvasContainer}
      style={{ width: lgv.dynamicBlocks.totalWidthPx, height: featuresHeight }}
      onContextMenu={(event) => {
        event.preventDefault()
        if (contextMenuItems.length > 0) {
          // There's already a context menu open, so close it
          setContextMenuItems([])
        } else {
          const coord: [number, number] = [event.clientX, event.clientY]
          setContextCoord(coord)
          setContextMenuItems(getContextMenuItems(coord))
        }
      }}
    >
      {loadingRegions ? (
        <div className={classes.loading}>
          <LoadingEllipses />
        </div>
      ) : null}
      {message ? (
        <Alert severity="warning" classes={{ message: classes.ellipses }}>
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
            onClick={() => {
              tabularEditor.showPane()
            }}
            className={classes.canvas}
            style={{ cursor: cursor ?? 'default' }}
            data-testid="overlayCanvas"
          />
          <Menu
            open={contextMenuItems.length > 0}
            onMenuItemClick={(_, callback) => {
              callback()
              setContextMenuItems([])
            }}
            onClose={() => {
              setContextMenuItems([])
            }}
            TransitionProps={{
              onExit: () => {
                setContextMenuItems([])
              },
            }}
            anchorReference="anchorPosition"
            anchorPosition={
              contextCoord
                ? { top: contextCoord[1], left: contextCoord[0] }
                : undefined
            }
            style={{ zIndex: theme.zIndex.tooltip }}
            menuItems={contextMenuItems}
          />
        </>
      )}
    </div>
  )
})
