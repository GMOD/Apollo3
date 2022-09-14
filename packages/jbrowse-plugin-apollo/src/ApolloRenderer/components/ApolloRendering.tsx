import { Region, getSession } from '@jbrowse/core/util'
import { Menu, MenuItem } from '@mui/material'
import { AnnotationFeatureI } from 'apollo-mst'
import { Change, LocationEndChange, LocationStartChange } from 'apollo-shared'
import { observer } from 'mobx-react'
import { getSnapshot } from 'mobx-state-tree'
import React, { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'

import { AddFeature } from '../../components/AddFeature'
import { CopyFeature } from '../../components/CopyFeature'
import { DeleteFeature } from '../../components/DeleteFeature'
import { LinearApolloDisplay } from '../../LinearApolloDisplay/stateModel'

interface ApolloRenderingProps {
  assemblyName: string
  regions: Region[]
  bpPerPx: number
  displayModel: LinearApolloDisplay
  blockKey: string
}

type Coord = [number, number]

function ApolloRendering(props: ApolloRenderingProps) {
  const [contextCoord, setContextCoord] = useState<Coord>()
  const [contextMenuFeature, setContextMenuFeature] =
    useState<AnnotationFeatureI>()

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
  const [overEdge, setOverEdge] = useState<'start' | 'end'>()
  const [dragging, setDragging] = useState<{
    edge: 'start' | 'end'
    feature: AnnotationFeatureI
    row: number
    bp: number
    px: number
  }>()
  const [movedDuringLastMouseDown, setMovedDuringLastMouseDown] =
    useState(false)
  const { regions, bpPerPx, displayModel } = props
  const session = getSession(displayModel)

  const [region] = regions
  const totalWidth = (region.end - region.start) / bpPerPx
  const {
    featureLayout,
    apolloFeatureUnderMouse,
    setApolloFeatureUnderMouse,
    apolloRowUnderMouse,
    setApolloRowUnderMouse,
    changeManager,
    getAssemblyId,
    selectedFeature,
    setSelectedFeature,
    features,
    featuresHeight: totalHeight,
    apolloRowHeight: height,
  } = displayModel
  // use this to convince useEffect that the features really did change
  const featureSnap = Array.from(features.values()).map((a) =>
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    Array.from(a.values()).map((f) => getSnapshot(f)),
  )
  useEffect(() => {
    const tokenParts = sessionStorage
      .getItem('apolloInternetAccount-token')!
      .split('.')
    const encodedPayload = tokenParts[1]
    const rawPayload = window.atob(encodedPayload)
    const clientUser = JSON.parse(rawPayload)

    const socket = io('http://localhost:3999')
    const { notify } = session
    const assName = region.assemblyName
    if (assName) {
      const [firstRef] = regions
      const channel = `${assName}-${firstRef.refName}`
      console.log(`User '${clientUser.username}' starts listening '${channel}'`)
      socket.removeAllListeners()
      socket.off()
      socket.on(channel, (message) => {
        console.log(`Change : ${JSON.stringify(message.changeInfo)}`)
        if (message.userName !== clientUser.username) {
          changeManager?.submitToClientOnly(message.changeInfo)
          notify(
            `${JSON.stringify(message.userName)} changed : ${JSON.stringify(
              message.changeInfo,
            )}`,
            'success',
          )
        }
      })
    }
  }, [region.refName])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }
    ctx.clearRect(0, 0, totalWidth, totalHeight)
    for (const [row, featureInfos] of featureLayout) {
      for (const [featureRow, feature] of featureInfos) {
        if (featureRow > 0) {
          continue
        }
        const start = feature.start - region.start - 1
        const startPx = start / bpPerPx
        feature.draw(ctx, startPx, row * height, bpPerPx, height)
      }
    }
  }, [
    bpPerPx,
    region.start,
    totalWidth,
    featureLayout,
    totalHeight,
    features,
    height,
    featureSnap,
  ])
  useEffect(() => {
    const canvas = overlayCanvasRef.current
    if (!canvas) {
      return
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }
    ctx.clearRect(0, 0, totalWidth, totalHeight)
    if (dragging) {
      const { feature, row, edge, px } = dragging
      const featureEdgePx = (feature[edge] - region.start) / bpPerPx
      const startPx = Math.min(px, featureEdgePx)
      const widthPx = Math.abs(px - featureEdgePx)
      ctx.strokeStyle = 'red'
      ctx.setLineDash([6])
      ctx.strokeRect(startPx, row * height, widthPx, height * feature.rowCount)
      ctx.fillStyle = 'rgba(255,0,0,.2)'
      ctx.fillRect(startPx, row * height, widthPx, height * feature.rowCount)
    }
    const feature = dragging?.feature || apolloFeatureUnderMouse
    const row = dragging?.row || apolloRowUnderMouse
    if (feature && row !== undefined) {
      const start = feature.start - region.start - 1
      const width = feature.length
      const startPx = start / bpPerPx
      const widthPx = width / bpPerPx
      ctx.fillStyle = 'rgba(0,0,0,0.2)'
      ctx.fillRect(startPx, row * height, widthPx, height * feature.rowCount)
    }
  }, [
    apolloFeatureUnderMouse,
    apolloRowUnderMouse,
    bpPerPx,
    totalHeight,
    totalWidth,
    region.start,
    dragging,
    height,
  ])
  function onMouseMove(event: React.MouseEvent<HTMLCanvasElement, MouseEvent>) {
    const { clientX, clientY, buttons } = event
    if (!movedDuringLastMouseDown && buttons === 1) {
      setMovedDuringLastMouseDown(true)
    }
    const { left, top } = canvasRef.current?.getBoundingClientRect() || {
      left: 0,
      top: 0,
    }
    // get pixel coordinates within the whole canvas
    let x = clientX - left
    // adjust for region reversal
    x = region.reversed ? totalWidth - x : x
    const y = clientY - top

    if (dragging) {
      const { edge, feature, row } = dragging
      let px = x
      let bp = region.start + x * bpPerPx
      if (edge === 'start' && bp > feature.end - 1) {
        bp = feature.end - 1
        px = (bp - region.start) / bpPerPx
      } else if (edge === 'end' && bp < feature.start + 1) {
        bp = feature.start + 1
        px = (bp - region.start) / bpPerPx
      }
      setDragging({
        edge,
        feature,
        row,
        px,
        bp,
      })
      return
    }

    const row = Math.floor(y / height)
    if (row === undefined) {
      setApolloFeatureUnderMouse(undefined)
      setApolloRowUnderMouse(undefined)
      return
    }
    const layoutRow = featureLayout.get(row)
    if (!layoutRow) {
      setApolloFeatureUnderMouse(undefined)
      setApolloRowUnderMouse(undefined)
      return
    }
    const bp = region.start + bpPerPx * x
    const [featureRow, feat] =
      layoutRow.find((f) => bp >= f[1].min && bp <= f[1].max) || []
    let feature: AnnotationFeatureI | undefined = feat
    if (feature && featureRow) {
      const topRow = row - featureRow
      const startPx = (feature.start - region.start) / bpPerPx
      const thisX = x - startPx
      feature = feature.getFeatureFromLayout(
        thisX,
        y - topRow * height,
        bpPerPx,
        height,
      ) as AnnotationFeatureI
    }
    if (feature) {
      // TODO: check reversed
      // TODO: ensure feature is in interbase
      const startPx = (feature.start - region.start) / bpPerPx
      const endPx = (feature.end - region.start) / bpPerPx
      if (endPx - startPx < 8) {
        setOverEdge(undefined)
      } else if (Math.abs(startPx - x) < 4) {
        setOverEdge('start')
      } else if (Math.abs(endPx - x) < 4) {
        setOverEdge('end')
      } else {
        setOverEdge(undefined)
      }
    }
    setApolloFeatureUnderMouse(feature)
    setApolloRowUnderMouse(row)
  }
  function onMouseLeave() {
    setApolloFeatureUnderMouse(undefined)
    setApolloRowUnderMouse(undefined)
  }
  function onMouseDown(event: React.MouseEvent) {
    if (apolloFeatureUnderMouse && overEdge) {
      event.stopPropagation()
      setDragging({
        edge: overEdge,
        feature: apolloFeatureUnderMouse,
        row: apolloRowUnderMouse || 0,
        px: (apolloFeatureUnderMouse[overEdge] - region.start) / bpPerPx,
        bp: apolloFeatureUnderMouse[overEdge],
      })
    }
  }
  function onMouseUp() {
    if (!movedDuringLastMouseDown) {
      if (apolloFeatureUnderMouse) {
        setSelectedFeature(apolloFeatureUnderMouse)
      }
    } else if (dragging) {
      const assemblyId = getAssemblyId(region.assemblyName)
      const { feature, bp, edge } = dragging
      let change: Change
      if (edge === 'end') {
        const featureId = feature._id
        const oldEnd = feature.end
        const newEnd = Math.round(bp)
        change = new LocationEndChange({
          typeName: 'LocationEndChange',
          changedIds: [featureId],
          featureId,
          oldEnd,
          newEnd,
          assemblyId,
        })
      } else {
        const featureId = feature._id
        const oldStart = feature.start
        const newStart = Math.round(bp)
        change = new LocationStartChange({
          typeName: 'LocationStartChange',
          changedIds: [featureId],
          featureId,
          oldStart,
          newStart,
          assemblyId,
        })
      }
      changeManager?.submit(change)
    }
    setDragging(undefined)
    setMovedDuringLastMouseDown(false)
  }
  function onContextMenu(event: React.MouseEvent) {
    event.preventDefault()
    setContextMenuFeature(apolloFeatureUnderMouse)
    setContextCoord([event.pageX, event.pageY])
  }

  return (
    <div
      style={{ position: 'relative', width: totalWidth, height: totalHeight }}
    >
      <Menu
        open={Boolean(contextMenuFeature)}
        anchorReference="anchorPosition"
        anchorPosition={
          contextCoord
            ? { left: contextCoord[0], top: contextCoord[1] }
            : undefined
        }
        data-testid="base_linear_display_context_menu"
        onClose={() => {
          setContextMenuFeature(undefined)
        }}
      >
        <MenuItem
          key={1}
          value={1}
          onClick={() => {
            const currentAssemblyId = getAssemblyId(region.assemblyName)
            session.queueDialog((doneCallback) => [
              AddFeature,
              {
                session,
                handleClose: () => {
                  doneCallback()
                },
                changeManager,
                sourceFeature: contextMenuFeature,
                sourceAssemblyId: currentAssemblyId,
              },
            ])
            setContextMenuFeature(undefined)
          }}
        >
          {'Add child feature'}
        </MenuItem>
        <MenuItem
          key={2}
          value={2}
          onClick={() => {
            const currentAssemblyId = getAssemblyId(region.assemblyName)
            session.queueDialog((doneCallback) => [
              CopyFeature,
              {
                session,
                handleClose: () => {
                  doneCallback()
                },
                changeManager,
                sourceFeature: contextMenuFeature,
                sourceAssemblyId: currentAssemblyId,
              },
            ])
            setContextMenuFeature(undefined)
          }}
        >
          {'Copy features and annotations'}
        </MenuItem>
        <MenuItem
          key={3}
          value={3}
          onClick={() => {
            const currentAssemblyId = getAssemblyId(region.assemblyName)
            session.queueDialog((doneCallback) => [
              DeleteFeature,
              {
                session,
                handleClose: () => {
                  doneCallback()
                },
                changeManager,
                sourceFeature: contextMenuFeature,
                sourceAssemblyId: currentAssemblyId,
                selectedFeature,
                setSelectedFeature,
              },
            ])
            setContextMenuFeature(undefined)
          }}
        >
          {'Delete feature'}
        </MenuItem>
      </Menu>
      <canvas
        ref={canvasRef}
        width={totalWidth}
        height={totalHeight}
        style={{ position: 'absolute', left: 0, top: 0 }}
      />
      <canvas
        ref={overlayCanvasRef}
        width={totalWidth}
        height={totalHeight}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onContextMenu={onContextMenu}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          cursor:
            dragging || (apolloFeatureUnderMouse && overEdge)
              ? 'col-resize'
              : 'default',
        }}
      />
    </div>
  )
}

export default observer(ApolloRendering)
