import { getContainingView } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'
import React from 'react'
import { makeStyles } from 'tss-react/mui'

import { LinearApolloDisplay as LinearApolloDisplayI } from '../stateModel'

interface LinearApolloDisplayProps {
  model: LinearApolloDisplayI
}

const useStyles = makeStyles()((theme) => ({
  canvasContainer: {
    position: 'relative',
    left: 0,
  },
  canvas: {
    position: 'absolute',
    left: 0,
  },
}))

export const LinearApolloDisplay = observer(
  (props: LinearApolloDisplayProps) => {
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
      apolloDragging: dragging,
      apolloFeatureUnderMouse,
      overEdge,
    } = model
    const { classes } = useStyles()
    const lgv = getContainingView(model) as unknown as LinearGenomeViewModel

    return (
      <div
        className={classes.canvasContainer}
        style={{
          left: 0,
          width: lgv.dynamicBlocks.totalWidthPx,
          height: featuresHeight,
        }}
      >
        <canvas
          ref={(ref) => {
            setCanvas(ref)
          }}
          width={lgv.dynamicBlocks.totalWidthPx}
          height={featuresHeight}
          className={classes.canvas}
        />
        <canvas
          ref={(ref) => {
            setOverlayCanvas(ref)
          }}
          width={lgv.dynamicBlocks.totalWidthPx}
          height={featuresHeight}
          onMouseMove={onMouseMove}
          onMouseLeave={onMouseLeave}
          onMouseDown={onMouseDown}
          onMouseUp={onMouseUp}
          onContextMenu={onContextMenu}
          className={classes.canvas}
          style={{
            cursor:
              dragging || (apolloFeatureUnderMouse && overEdge)
                ? 'col-resize'
                : 'default',
          }}
        />
      </div>
    )
  },
)
