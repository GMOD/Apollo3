/* eslint-disable @typescript-eslint/unbound-method */

/* eslint-disable @typescript-eslint/no-misused-promises */

import { observer } from 'mobx-react'
import React, { useCallback, useState } from 'react'

import { type Coord, useStyles } from '../../util/displayUtils'
import type { LinearApolloDisplay as LinearApolloDisplayI } from '../stateModel'

import { Tooltip as LinearApolloDisplayTooltip } from './Tooltip'

interface LinearApolloDisplayProps {
  model: LinearApolloDisplayI
}

export const OverlayCanvas = observer(function OverlayCanvas(
  props: LinearApolloDisplayProps,
) {
  const { model } = props
  const {
    apolloDragging,
    cursor,
    isShown,
    onMouseDown,
    onMouseLeave,
    onMouseMove,
    onMouseUp,
    session,
    setOverlayCanvas,
  } = model
  const { classes } = useStyles()

  // Stable ref callback so React doesn't call it with null and then the node
  // again on every render.
  // Promise.resolve() in this callback is to avoid infinite rendering loop
  // https://github.com/mobxjs/mobx/issues/3728#issuecomment-1715400931
  const overlayCanvasRef = useCallback(
    async (node: HTMLCanvasElement | null) => {
      await Promise.resolve()
      setOverlayCanvas(node)
    },
    [setOverlayCanvas],
  )
  const [mouseCoord, setMouseCoord] = useState<Coord>()
  if (!isShown) {
    return null
  }
  return (
    <>
      <canvas
        ref={overlayCanvasRef}
        onMouseMove={(...args) => {
          const [event] = args
          setMouseCoord([event.clientX, event.clientY])
          onMouseMove(...args)
        }}
        onMouseLeave={(...args) => {
          setMouseCoord(undefined)
          onMouseLeave(...args)
        }}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        className={classes.canvas}
        style={{ cursor: cursor ?? 'default' }}
        data-testid="overlayCanvas"
      />
      <LinearApolloDisplayTooltip
        mouseCooordinate={mouseCoord}
        session={session}
        dragging={Boolean(apolloDragging)}
      />
    </>
  )
})
