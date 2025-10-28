/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { type CheckResultI } from '@apollo-annotation/mst'
import { Menu, type MenuItem } from '@jbrowse/core/ui'
import {
  type AbstractSessionModel,
  doesIntersect2,
  getContainingView,
} from '@jbrowse/core/util'
import { type LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import ErrorIcon from '@mui/icons-material/Error'
import LockIcon from '@mui/icons-material/Lock'
import {
  Alert,
  Avatar,
  Badge,
  Box,
  CircularProgress,
  Tooltip,
  useTheme,
} from '@mui/material'
import { observer } from 'mobx-react'
import React, { useEffect, useState } from 'react'

import {
  type Coord,
  clusterResultByMessage,
  useStyles,
} from '../../util/displayUtils'
import { type LinearApolloDisplay as LinearApolloDisplayI } from '../stateModel'

interface LinearApolloDisplayProps {
  model: LinearApolloDisplayI
}

// Lock icon when isLocked === true

export const LinearApolloDisplay = observer(function LinearApolloDisplay(
  props: LinearApolloDisplayProps,
) {
  const theme = useTheme()
  const { model } = props
  const {
    loading,
    apolloDragging,
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
    showCheckResults,
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
            setContextMenuItems(getContextMenuItems(event))
          }
        }}
      >
        {session.isLocked ? (
          <div className={classes.locked} data-testid="lock-icon">
            <LockIcon />
          </div>
        ) : null}
        {loading ? (
          <div className={classes.loading}>
            <CircularProgress size="18px" />
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
              className={classes.canvas}
              style={{ cursor: cursor ?? 'default' }}
              data-testid="overlayCanvas"
            />
            {lgv.displayedRegions.flatMap((region, idx) => {
              const widthBp = lgv.bpPerPx * apolloRowHeight
              const assembly = assemblyManager.get(region.assemblyName)
              if (showCheckResults) {
                const filteredCheckResults = [
                  ...session.apolloDataStore.checkResults.values(),
                ].filter(
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
                const checkResults = clusterResultByMessage<CheckResultI>(
                  filteredCheckResults,
                  widthBp,
                  true,
                )
                return checkResults.map((checkResult) => {
                  const left =
                    (lgv.bpToPx({
                      refName: region.refName,
                      coord: checkResult.start,
                      regionNumber: idx,
                    })?.offsetPx ?? 0) - lgv.offsetPx
                  const [feature] = checkResult.featureIds
                  if (!feature) {
                    return null
                  }
                  let row = 0
                  const featureLayout = model.getFeatureLayoutPosition(feature)
                  if (featureLayout) {
                    row =
                      featureLayout.layoutRowIndex +
                      featureLayout.featureRowIndex
                  }
                  const top = row * apolloRowHeight
                  const height = apolloRowHeight
                  return (
                    <Tooltip key={checkResult._id} title={checkResult.message}>
                      <Box
                        className={classes.box}
                        style={{
                          top,
                          left,
                          height,
                          width: height,
                          pointerEvents: apolloDragging ? 'none' : 'auto',
                        }}
                      >
                        <Badge
                          className={classes.badge}
                          badgeContent={checkResult.count}
                          color="primary"
                          overlap="circular"
                          anchorOrigin={{
                            vertical: 'bottom',
                            horizontal: 'right',
                          }}
                          invisible={checkResult.count <= 1}
                        >
                          <Avatar className={classes.avatar}>
                            <ErrorIcon
                              data-testid={`ErrorIcon-${checkResult.start}`}
                            />
                          </Avatar>
                        </Badge>
                      </Box>
                    </Tooltip>
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
})
