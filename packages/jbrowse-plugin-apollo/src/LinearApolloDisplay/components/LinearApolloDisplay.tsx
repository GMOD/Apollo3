import { Menu, MenuItem } from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { Alert, Tooltip, useTheme } from '@mui/material'
import { observer } from 'mobx-react'
import React, { useEffect, useState } from 'react'
import { makeStyles } from 'tss-react/mui'

import { LinearApolloDisplay as LinearApolloDisplayI } from '../stateModel'

interface LinearApolloDisplayProps {
  model: LinearApolloDisplayI
}
export type Coord = [number, number]

const useStyles = makeStyles()({
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
})

export const LinearApolloDisplay = observer(
  (props: LinearApolloDisplayProps) => {
    const theme = useTheme()
    const { model } = props
    const {
      contextMenuItems: getContextMenuItems,
      cursor,
      featuresHeight,
      onMouseDown,
      onMouseLeave,
      onMouseMove,
      onMouseUp,
      regionCannotBeRendered,
      setCanvas,
      setCollaboratorCanvas,
      setOverlayCanvas,
      setTheme,
    } = model
    const { classes } = useStyles()
    const lgv = getContainingView(model) as unknown as LinearGenomeViewModel

    useEffect(() => setTheme(theme), [theme, setTheme])
    const [contextCoord, setContextCoord] = useState<Coord>()
    const [contextMenuItems, setContextMenuItems] = useState<MenuItem[]>([])
    const message = regionCannotBeRendered()

    return (
      <div
        className={classes.canvasContainer}
        style={{
          width: lgv.dynamicBlocks.totalWidthPx,
          height: featuresHeight,
        }}
        onContextMenu={(event) => {
          event.preventDefault()
          if (contextMenuItems.length) {
            // There's already a context menu open, so close it
            setContextMenuItems([])
          } else {
            const coord: [number, number] = [event.clientX, event.clientY]
            setContextCoord(coord)
            setContextMenuItems(getContextMenuItems(coord))
          }
        }}
      >
        {message ? (
          <Alert severity="warning" classes={{ message: classes.ellipses }}>
            <Tooltip title={message}>
              <div>{message}</div>
            </Tooltip>
          </Alert>
        ) : (
          <>
            <canvas
              ref={(node) => {
                setCollaboratorCanvas(node)
              }}
              width={lgv.dynamicBlocks.totalWidthPx}
              height={featuresHeight}
              className={classes.canvas}
            />
            <canvas
              ref={(node) => {
                setCanvas(node)
              }}
              width={lgv.dynamicBlocks.totalWidthPx}
              height={featuresHeight}
              className={classes.canvas}
            />
            <canvas
              ref={(node) => {
                setOverlayCanvas(node)
              }}
              width={lgv.dynamicBlocks.totalWidthPx}
              height={featuresHeight}
              onMouseMove={onMouseMove}
              onMouseLeave={onMouseLeave}
              onMouseDown={onMouseDown}
              onMouseUp={onMouseUp}
              className={classes.canvas}
              style={{ cursor: cursor || 'default' }}
            />
            <Menu
              open={Boolean(contextMenuItems.length)}
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
  },
)
