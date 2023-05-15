import { getContainingView } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'
import React, { useEffect } from 'react'
import { makeStyles } from 'tss-react/mui'

import { LinearApolloDisplay as LinearApolloDisplayI } from '../stateModel'

interface LinearApolloDisplayProps {
  model: LinearApolloDisplayI
}

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
    } = model
    const { classes } = useStyles()
    const lgv = getContainingView(model) as unknown as LinearGenomeViewModel

    useEffect(() => setTheme(theme), [theme, setTheme])

    return (
      <div
        className={classes.canvasContainer}
        style={{
          width: lgv.dynamicBlocks.totalWidthPx,
          height: featuresHeight,
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
      </div>
    )
  },
)
