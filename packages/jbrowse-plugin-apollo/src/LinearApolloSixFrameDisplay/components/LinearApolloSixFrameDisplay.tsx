/* eslint-disable @typescript-eslint/unbound-method */

/* eslint-disable @typescript-eslint/no-misused-promises */

import type { CheckResultI } from '@apollo-annotation/mst'
import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import { Menu, type MenuItem } from '@jbrowse/core/ui'
import {
  type AbstractSessionModel,
  doesIntersect2,
  getContainingView,
} from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import LockIcon from '@mui/icons-material/Lock'
import { Alert, Tooltip, useTheme } from '@mui/material'
import { observer } from 'mobx-react'
import React, { useCallback, useEffect, useState } from 'react'

import { CheckResultIcon } from '../../components/CheckResultIcon'
import { FeatureDensityHistogram } from '../../components/FeatureDensityHistogram'
import {
  type Coord,
  clusterResultByMessage,
  useStyles,
} from '../../util/displayUtils'
import { getLeftPx, looksLikeGene } from '../../util/glyphUtils'
import type { LinearApolloSixFrameDisplay as LinearApolloSixFrameDisplayI } from '../stateModel'

import { Tooltip as LinearApolloSixFrameDisplayTooltip } from './Tooltip'
import { TrackLines } from './TrackLines'

interface LinearApolloSixFrameDisplayProps {
  model: LinearApolloSixFrameDisplayI
}

export const LinearApolloSixFrameDisplay = observer(
  function LinearApolloSixFrameDisplay(
    props: LinearApolloSixFrameDisplayProps,
    apolloDragging,
  ) {
    const theme = useTheme()
    const { model } = props
    const {
      apolloRowHeight,
      contextMenuItems: getContextMenuItems,
      cursor,
      featuresHeight,
      getRowForFeature,
      isShown,
      onMouseDown,
      onMouseLeave,
      onMouseMove,
      onMouseUp,
      densityMessage,
      displayMode,
      session,
      setCanvas,
      setCollaboratorCanvas,
      setOverlayCanvas,
      setTheme,
      showCheckResults,
    } = model
    const { classes } = useStyles()
    const lgv = getContainingView(model) as unknown as LinearGenomeViewModel

    useEffect(() => {
      setTheme(theme)
    }, [theme, setTheme])
    // Stable ref callbacks so React doesn't call them with null and then the
    // node again on every render, which would set the canvas twice and redraw
    // it.
    // Promise.resolve() in these 3 callbacks is to avoid infinite rendering
    // loop https://github.com/mobxjs/mobx/issues/3728#issuecomment-1715400931
    const collaboratorCanvasRef = useCallback(
      async (node: HTMLCanvasElement | null) => {
        await Promise.resolve()
        setCollaboratorCanvas(node)
      },
      [setCollaboratorCanvas],
    )
    const canvasRef = useCallback(
      async (node: HTMLCanvasElement | null) => {
        await Promise.resolve()
        setCanvas(node)
      },
      [setCanvas],
    )
    const overlayCanvasRef = useCallback(
      async (node: HTMLCanvasElement | null) => {
        await Promise.resolve()
        setOverlayCanvas(node)
      },
      [setOverlayCanvas],
    )
    const [contextCoord, setContextCoord] = useState<Coord>()
    const [contextMenuItems, setContextMenuItems] = useState<MenuItem[]>([])
    const [mouseCoord, setMouseCoord] = useState<Coord>()

    const message = densityMessage
    const showHistogram = !message && displayMode !== 'features'
    if (!isShown) {
      return null
    }
    const { assemblyManager } = session as unknown as AbstractSessionModel
    return (
      <>
        <div
          className={classes.canvasContainer}
          style={{
            width: lgv.dynamicBlocks.totalWidthPx,
            // The histogram fills the track
            height: showHistogram ? '100%' : featuresHeight,
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
        >
          {session.isLocked ? (
            <div className={classes.locked} data-testid="lock-icon">
              <LockIcon />
            </div>
          ) : null}
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
          ) : null}
          {showHistogram ? <FeatureDensityHistogram model={model} /> : null}
          {message || showHistogram ? null : (
            <>
              <TrackLines model={model} idx={0} />
              <TrackLines
                model={model}
                hrStyle={{ margin: 0, top: 0, color: 'grey', opacity: 0.4 }}
                idx={1}
              />
              <TrackLines model={model} idx={2} />
              <canvas
                ref={collaboratorCanvasRef}
                className={classes.canvas}
                data-testid="collaboratorCanvas"
              />
              <canvas
                ref={canvasRef}
                className={classes.canvas}
                data-testid="canvas"
              />
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
              <LinearApolloSixFrameDisplayTooltip
                mouseCoordinate={mouseCoord}
                model={model}
              />
              {lgv.dynamicBlocks.contentBlocks.flatMap((block) => {
                const widthBp = lgv.bpPerPx * apolloRowHeight
                const assembly = assemblyManager.get(block.assemblyName) as
                  | Assembly
                  | undefined
                if (showCheckResults) {
                  const filteredCheckResults = [
                    ...session.apolloDataStore.checkResults.values(),
                  ].filter(
                    (checkResult) =>
                      assembly?.isValidRefName(checkResult.refSeq) &&
                      assembly.getCanonicalRefName(checkResult.refSeq) ===
                        block.refName &&
                      doesIntersect2(
                        block.start,
                        block.end,
                        checkResult.start,
                        checkResult.end,
                      ),
                  )
                  const checkResults = clusterResultByMessage<CheckResultI>(
                    filteredCheckResults,
                    widthBp,
                    true,
                  )
                  return checkResults.map((checkResult) => {
                    const left = Math.round(
                      getLeftPx(model, checkResult.range, block),
                    )
                    const [feature] = checkResult.featureIds
                    if (
                      !feature?.parent ||
                      !looksLikeGene(feature.parent, session)
                    ) {
                      return null
                    }

                    const row = getRowForFeature(feature, checkResult.start)
                    if (row === undefined) {
                      return null
                    }

                    return (
                      <CheckResultIcon
                        key={`${block.key}-${checkResult._id}`}
                        top={row * apolloRowHeight}
                        left={left}
                        size={apolloRowHeight}
                        disablePointerEvents={Boolean(apolloDragging)}
                        message={checkResult.message}
                        count={checkResult.count}
                        start={checkResult.start}
                      />
                    )
                  })
                }
                return null
              })}
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
                style={{ zIndex: theme.zIndex.tooltip }}
                menuItems={contextMenuItems}
              />
            </>
          )}
        </div>
      </>
    )
  },
)
