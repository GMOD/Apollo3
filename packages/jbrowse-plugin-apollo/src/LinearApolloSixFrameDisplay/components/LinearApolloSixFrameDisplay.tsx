/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { Menu, type MenuItem } from '@jbrowse/core/ui'
import {
  type AbstractSessionModel,
  doesIntersect2,
  getContainingView,
} from '@jbrowse/core/util'
import { type LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import ErrorIcon from '@mui/icons-material/Error'
import { Alert, Avatar, Tooltip, useTheme } from '@mui/material'
import { observer } from 'mobx-react'
import React, { useEffect, useState } from 'react'
import { makeStyles } from 'tss-react/mui'

import { type LinearApolloSixFrameDisplay as LinearApolloSixFrameDisplayI } from '../stateModel'

import { TrackLines } from './TrackLines'

interface LinearApolloSixFrameDisplayProps {
  model: LinearApolloSixFrameDisplayI
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
  avatar: {
    position: 'absolute',
    color: theme.palette.warning.light,
    backgroundColor: theme.palette.warning.contrastText,
  },
}))

export const LinearApolloSixFrameDisplay = observer(
  function LinearApolloSixFrameDisplay(
    props: LinearApolloSixFrameDisplayProps,
  ) {
    const theme = useTheme()
    const { model } = props
    const {
      apolloRowHeight,
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
    const message = regionCannotBeRendered()
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
            // Promise.resolve() in these 3 callbacks is to avoid infinite rendering loop
            // https://github.com/mobxjs/mobx/issues/3728#issuecomment-1715400931
            <>
              <TrackLines model={model} idx={0} />
              <TrackLines
                model={model}
                hrStyle={{ margin: 0, top: 0, color: 'grey', opacity: 0.4 }}
                idx={1}
              />
              <TrackLines model={model} idx={2} />
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
              {lgv.displayedRegions.flatMap((region, idx) => {
                const assembly = assemblyManager.get(region.assemblyName)
                return [...session.apolloDataStore.checkResults.values()]
                  .filter(
                    (checkResult) =>
                      assembly?.isValidRefName(checkResult.refSeq) &&
                      assembly.getCanonicalRefName(checkResult.refSeq) ===
                        region.refName &&
                      doesIntersect2(
                        region.start,
                        region.end,
                        checkResult.start,
                        checkResult.end,
                      ),
                  )
                  .map((checkResult) => {
                    const left =
                      (lgv.bpToPx({
                        refName: region.refName,
                        coord: checkResult.start,
                        regionNumber: idx,
                      })?.offsetPx ?? 0) - lgv.offsetPx
                    const [feature] = checkResult.ids
                    if (!feature || !feature.parent?.looksLikeGene) {
                      return null
                    }
                    const top = 0
                    const height = apolloRowHeight
                    return (
                      <Tooltip
                        key={checkResult._id}
                        title={checkResult.message}
                      >
                        <Avatar
                          className={classes.avatar}
                          style={{ top, left, height, width: height }}
                        >
                          <ErrorIcon />
                        </Avatar>
                      </Tooltip>
                    )
                  })
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
      </>
    )
  },
)
