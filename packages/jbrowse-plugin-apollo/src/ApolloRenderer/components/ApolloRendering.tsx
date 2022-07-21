import { Region, getSession } from '@jbrowse/core/util'
import { Menu, MenuItem } from '@material-ui/core'
import {
  AnnotationFeatureLocationI,
  Change,
  LocationEndChange,
  LocationStartChange,
} from 'apollo-shared'
import { observer } from 'mobx-react'
import { getSnapshot } from 'mobx-state-tree'
import React, { useCallback, useEffect, useRef, useState } from 'react'

import { CopyFeaturesAndAnnotations } from '../../components/CopyFeaturesAndAnnotations'
import { LinearApolloDisplay } from '../../LinearApolloDisplay/stateModel'

interface ApolloRenderingProps {
  assemblyName: string
  regions: Region[]
  bpPerPx: number
  displayModel: LinearApolloDisplay
  blockKey: string
}

function ApolloRendering(props: ApolloRenderingProps) {
  const [anchorPoint, setAnchorPoint] = useState({ x: 0, y: 0 })
  const [show, setShow] = useState(false)
  type Coord = [number, number]
  const [contextCoord, setContextCoord] = useState<Coord>([10, 10])
  const [clientRect, setClientRect] = useState<DOMRect>()
  const [offsetMouseCoord, setOffsetMouseCoord] = useState<Coord>([0, 0])
  const [clientMouseCoord, setClientMouseCoord] = useState<Coord>([0, 0])
  const [selectedFeatureId, setSelectedFeatureId] = useState<string>()
  const handleContextMenu = useCallback(
    (event) => {
      console.log(
        `Set featureId: "${props.displayModel.apolloFeatureUnderMouse?.id}"`,
      )
      setSelectedFeatureId(props.displayModel.apolloFeatureUnderMouse?.id)
      event.preventDefault()
      setAnchorPoint({ x: event.pageX, y: event.pageY })
      setShow(true)
    },
    [setAnchorPoint],
  )
  const ref = useRef<HTMLDivElement>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
  const [overEdge, setOverEdge] = useState<'start' | 'end'>()
  const [dragging, setDragging] = useState<{
    edge: 'start' | 'end'
    feature: AnnotationFeatureLocationI
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
    setSelectedFeature,
    features,
  } = displayModel
  const height = 20
  const highestRow = Math.max(...featureLayout.keys())
  const totalHeight = highestRow * height
  // use this to convince useEffect that the features really did change
  const featureSnap = getSnapshot(features)
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
  ])
  function onMouseMove(event: React.MouseEvent<HTMLCanvasElement, MouseEvent>) {
    const { clientX, clientY, buttons } = event
    setContextCoord([clientX, clientY])
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
    let feature: AnnotationFeatureLocationI | undefined = feat
    if (feature && featureRow) {
      const topRow = row - featureRow
      const startPx = (feature.start - region.start) / bpPerPx
      const thisX = x - startPx
      feature = feature.getFeatureFromLayout(
        thisX,
        y - topRow * height,
        bpPerPx,
        height,
      ) as AnnotationFeatureLocationI
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
        const featureId = feature.id
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
        const featureId = feature.id
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

  return (
    <div style={{ position: 'relative', width: totalWidth, height }}>
      <div
        ref={ref}
        onContextMenu={(event) => {
          event.preventDefault()
          setContextCoord([event.clientX, event.clientY])
        }}
        onMouseMove={(event) => {
          if (!ref.current) {
            return
          }
          const rect = ref.current.getBoundingClientRect()
          const { left, top } = rect
          setOffsetMouseCoord([event.clientX - left, event.clientY - top])
          setClientMouseCoord([event.clientX, event.clientY])
          setClientRect(rect)
        }}
      >
        {show && selectedFeatureId ? (
          <Menu
            open={Boolean(contextCoord)}
            anchorReference="anchorPosition"
            anchorPosition={
              contextCoord
                ? { top: contextCoord[1], left: contextCoord[0] }
                : undefined
            }
            data-testid="base_linear_display_context_menu"
            onClose={() => {
              setShow(false)
            }}
          >
            <MenuItem
              key={1}
              value={2}
              onClick={(event) => {
                const currentAssemblyId = getAssemblyId(region.assemblyName)
                console.log(`FeatureId ${selectedFeatureId}`)
                console.log(`AssemblyId ${currentAssemblyId}`)
                console.log(`Open dialog to copy features...`)
                setShow(false)
                session.queueDialog((doneCallback) => [
                  CopyFeaturesAndAnnotations,
                  {
                    session,
                    handleClose: () => {
                      doneCallback()
                    },
                    selectedFeatureId,
                    currentAssemblyId,
                  },
                ])
              }}
            >
              {'Copy features and annotations'}
            </MenuItem>
          </Menu>
        ) : (
          <> </>
        )}
      </div>
      <canvas
        ref={canvasRef}
        width={totalWidth}
        height={totalHeight}
        style={{ position: 'absolute', left: 0, top: 0 }}
      />
      <canvas
        onContextMenu={handleContextMenu}
        ref={overlayCanvasRef}
        width={totalWidth}
        height={totalHeight}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
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
