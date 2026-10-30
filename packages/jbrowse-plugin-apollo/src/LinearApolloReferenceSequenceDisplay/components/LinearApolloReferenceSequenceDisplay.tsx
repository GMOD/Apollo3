/* eslint-disable @typescript-eslint/unbound-method */

/* eslint-disable @typescript-eslint/no-misused-promises */
import { getContainingView } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { Alert, Tooltip, useTheme } from '@mui/material'
import { observer } from 'mobx-react'
import React, { useCallback, useEffect } from 'react'

import { useStyles } from '../../util/displayUtils'
import type { LinearApolloReferenceSequenceDisplay as LinearApolloReferenceSequenceDisplayI } from '../stateModel'

interface LinearApolloReferenceSequenceDisplayProps {
  model: LinearApolloReferenceSequenceDisplayI
}

export const LinearApolloReferenceSequenceDisplay = observer(
  function LinearApolloReferenceSequenceDisplay(
    props: LinearApolloReferenceSequenceDisplayProps,
  ) {
    const theme = useTheme()
    const { model } = props
    const {
      height,
      regionCannotBeRendered,
      setSeqTrackCanvas,
      setSeqTrackOverlayCanvas,
      setTheme,
    } = model
    const { classes } = useStyles()
    useEffect(() => {
      setTheme(theme)
    }, [theme, setTheme])
    // Stable ref callbacks so React doesn't call them with null and then the
    // node again on every render, which would set the canvas twice and redraw
    // it.
    // Promise.resolve() in these 2 callbacks is to avoid infinite rendering
    // loop https://github.com/mobxjs/mobx/issues/3728#issuecomment-1715400931
    const seqTrackCanvasRef = useCallback(
      async (node: HTMLCanvasElement | null) => {
        await Promise.resolve()
        setSeqTrackCanvas(node)
      },
      [setSeqTrackCanvas],
    )
    const seqTrackOverlayCanvasRef = useCallback(
      async (node: HTMLCanvasElement | null) => {
        await Promise.resolve()
        setSeqTrackOverlayCanvas(node)
      },
      [setSeqTrackOverlayCanvas],
    )

    const lgv = getContainingView(model) as unknown as LinearGenomeViewModel
    const message = regionCannotBeRendered()

    // This type is wrong in @jbrowse/core
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (message) {
      return (
        <Alert
          severity="warning"
          classes={{ message: classes.ellipses }}
          slotProps={{ root: { className: classes.center } }}
        >
          <Tooltip title={message}>
            <div>{message}</div>
          </Tooltip>
        </Alert>
      )
    }

    return (
      <>
        {3 / lgv.bpPerPx >= 1 ? (
          <div
            className={classes.canvasContainer}
            style={{
              width: lgv.dynamicBlocks.totalWidthPx,
              height,
            }}
          >
            <canvas
              ref={seqTrackCanvasRef}
              className={classes.canvas}
              data-testid="seqTrackCanvas"
            />
            <canvas
              ref={seqTrackOverlayCanvasRef}
              className={classes.canvas}
              data-testid="seqTrackOverlayCanvas"
            />
          </div>
        ) : null}
      </>
    )
  },
)
