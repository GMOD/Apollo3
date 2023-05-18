import { Menu } from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { useTheme } from '@mui/material'
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
})

export const LinearApolloDisplay = observer(
  (props: LinearApolloDisplayProps) => {
    const theme = useTheme()
    const { model } = props
    const {
      featuresHeight,
      setCanvas,
      setOverlayCanvas,
      onMouseMove,
      onMouseLeave,
      onMouseDown,
      onMouseUp,
      onContextMenu,
      cursor,
      setTheme,
      contextMenuItems,
      setApolloContextMenuFeature,
    } = model
    const { classes } = useStyles()
    const lgv = getContainingView(model) as unknown as LinearGenomeViewModel

    useEffect(() => setTheme(theme), [theme, setTheme])
    const [contextCoord, setContextCoord] = useState<Coord>()

    return (
      <div
        className={classes.canvasContainer}
        style={{
          width: lgv.dynamicBlocks.totalWidthPx,
          height: featuresHeight,
        }}
        onContextMenu={(event) => {
          event.preventDefault()
          if (contextCoord) {
            // There's already a context menu open, so close it
            setContextCoord(undefined)
          } else {
            setContextCoord([event.clientX, event.clientY])
          }
        }}
      >
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
          onContextMenu={onContextMenu}
          className={classes.canvas}
          style={{ cursor: cursor || 'default' }}
        />
        <Menu
          open={
            Boolean(contextCoord) &&
            Boolean(contextMenuItems(contextCoord).length)
          }
          onMenuItemClick={(_, callback) => {
            callback()
            setContextCoord(undefined)
          }}
          onClose={() => {
            setContextCoord(undefined)
            setApolloContextMenuFeature(undefined)
          }}
          TransitionProps={{
            onExit: () => {
              setContextCoord(undefined)
              setApolloContextMenuFeature(undefined)
            },
          }}
          anchorReference="anchorPosition"
          anchorPosition={
            contextCoord
              ? { top: contextCoord[1], left: contextCoord[0] }
              : undefined
          }
          style={{ zIndex: theme.zIndex.tooltip }}
          menuItems={contextMenuItems(contextCoord)}
        />
      </div>
    )
  },
)
