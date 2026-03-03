/* eslint-disable @typescript-eslint/unbound-method */

/* eslint-disable @typescript-eslint/no-misused-promises */

import { getContainingView } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'
import React, { useState } from 'react'

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
    cursor,
    featuresHeight: getFeaturesHeight,
    isShown,
    onMouseDown,
    onMouseLeave,
    onMouseMove,
    onMouseUp,
    session,
    setOverlayCanvas,
  } = model
  const { classes } = useStyles()
  const lgv = getContainingView(model) as unknown as LinearGenomeViewModel

  const [mouseCoord, setMouseCoord] = useState<Coord>()
  if (!isShown) {
    return null
  }
  const featuresHeight = getFeaturesHeight(lgv.assemblyNames[0])
  // Promise.resolve() in this callback is to avoid infinite rendering loop
  // https://github.com/mobxjs/mobx/issues/3728#issuecomment-1715400931
  return (
    <>
      <canvas
        ref={async (node: HTMLCanvasElement) => {
          await Promise.resolve()
          setOverlayCanvas(node)
        }}
        width={lgv.dynamicBlocks.totalWidthPx}
        height={featuresHeight}
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
      />
    </>
  )
})
