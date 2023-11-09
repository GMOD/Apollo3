import { Menu, MenuItem } from '@jbrowse/core/ui'
import { AbstractSessionModel, getContainingView } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import WarningIcon from '@mui/icons-material/WarningAmberRounded'
import { Alert, Tooltip, useTheme } from '@mui/material'
import { observer } from 'mobx-react'
import React, { useEffect, useState } from 'react'
import { makeStyles } from 'tss-react/mui'

import { LinearApolloDisplay as LinearApolloDisplayI } from '../stateModel'
import { getGlyph } from '../stateModel/getGlyph'

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

export const LinearApolloDisplay = observer(function LinearApolloDisplay(
  props: LinearApolloDisplayProps,
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
    tabularEditor,
  } = model
  const { classes } = useStyles()
  const lgv = getContainingView(model) as unknown as LinearGenomeViewModel

  useEffect(() => setTheme(theme), [theme, setTheme])
  const [contextCoord, setContextCoord] = useState<Coord>()
  const [contextMenuItems, setContextMenuItems] = useState<MenuItem[]>([])
  const message = regionCannotBeRendered()
  if (!isShown) {
    return null
  }
  const { assemblyManager } = session as unknown as AbstractSessionModel
  return (
    <div
      className={classes.canvasContainer}
      style={{ width: lgv.dynamicBlocks.totalWidthPx, height: featuresHeight }}
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
            onClick={() => {
              tabularEditor.showPane()
            }}
            className={classes.canvas}
            style={{ cursor: cursor ?? 'default' }}
            data-testid="overlayCanvas"
          />
          {lgv.displayedRegions.flatMap((region, idx) => {
            const assembly = assemblyManager.get(region.assemblyName)
            return [...session.apolloDataStore.checkResults.values()]
              .filter(
                (checkResult) => assembly?.isValidRefName(checkResult.refSeq),
              )
              .map((checkResult) => {
                const left =
                  (lgv.bpToPx({
                    refName: region.refName,
                    coord: checkResult.start,
                    regionNumber: idx,
                  })?.offsetPx ?? 0) - lgv.offsetPx
                const [feature] = checkResult.ids
                let parent = feature
                while (parent?.parent) {
                  ;({ parent } = parent)
                }
                const topRow = parent
                  ? model.getFeatureLayoutPosition(parent)?.layoutRow ?? 0
                  : 0
                const rowCount = parent
                  ? getGlyph(parent, lgv.bpPerPx).getRowCount(
                      parent,
                      lgv.bpPerPx,
                    )
                  : 0
                const top = topRow * apolloRowHeight
                const height = rowCount * apolloRowHeight
                return (
                  <div
                    key={checkResult._id}
                    style={{
                      position: 'absolute',
                      top,
                      left,
                      height,
                      borderWidth: 1,
                      borderStyle: 'solid',
                      borderColor: 'black',
                    }}
                  >
                    <WarningIcon color="warning" />
                  </div>
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
  )
})
