import { Region } from '@jbrowse/core/util'
import {
  AnnotationFeatureI,
  Change,
  LocationEndChange,
  LocationStartChange,
} from 'apollo-shared'
import { observer } from 'mobx-react'
import React, { useEffect, useRef, useState } from 'react'

import { LinearApolloDisplay } from '../../LinearApolloDisplay/stateModel'

interface ApolloRenderingProps {
  features: Map<string, Map<string, Map<string, AnnotationFeatureI>>>
  assemblyName: string
  regions: Region[]
  bpPerPx: number
  displayModel: LinearApolloDisplay
  blockKey: string
}

function ApolloRendering(props: ApolloRenderingProps) {
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
  const { regions, bpPerPx, displayModel } = props
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
  } = displayModel
  const height = 20
  const padding = 4
  const highestRow = Math.max(...featureLayout.keys())
  const totalHeight = highestRow * (height + padding)
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
    for (const [row, features] of featureLayout.entries()) {
      features.forEach((feature) => {
        const start = feature.location.start - region.start - 1
        const width = feature.location.length
        const startPx = start / bpPerPx
        const widthPx = width / bpPerPx
        ctx.fillStyle = 'black'
        ctx.fillRect(startPx, row * (height + 4) + padding, widthPx, height)
        if (widthPx > 2) {
          ctx.clearRect(
            startPx + 1,
            row * (height + padding) + 1 + padding,
            widthPx - 2,
            height - 2,
          )
          ctx.fillStyle = 'rgba(255,255,255,0.75)'
          ctx.fillRect(
            startPx + 1,
            row * (height + padding) + 1 + padding,
            widthPx - 2,
            height - 2,
          )
        }
      })
    }
  }, [
    bpPerPx,
    region.start,
    totalWidth,
    featureLayout,
    highestRow,
    totalHeight,
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
      const featureEdgePx = (feature.location[edge] - region.start) / bpPerPx
      const startPx = Math.min(px, featureEdgePx)
      const widthPx = Math.abs(px - featureEdgePx)
      ctx.strokeStyle = 'red'
      ctx.setLineDash([6])
      ctx.strokeRect(startPx, row * (height + 4) + padding, widthPx, height)
      ctx.fillStyle = 'rgba(255,0,0,.2)'
      ctx.fillRect(startPx, row * (height + 4) + padding, widthPx, height)
    }
    const feature = dragging?.feature || apolloFeatureUnderMouse
    const row = dragging?.row || apolloRowUnderMouse
    if (feature && row !== undefined) {
      const start = feature.location.start - region.start - 1
      const width = feature.location.length
      const startPx = start / bpPerPx
      const widthPx = width / bpPerPx
      ctx.fillStyle = 'rgba(0,0,0,0.2)'
      ctx.fillRect(startPx, row * (height + 4) + padding, widthPx, height)
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
    const { clientX, clientY } = event
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
      if (edge === 'start' && bp > feature.location.end - 1) {
        bp = feature.location.end - 1
        px = (bp - region.start) / bpPerPx
      } else if (edge === 'end' && bp < feature.location.start + 1) {
        bp = feature.location.start + 1
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

    const row =
      // this will be false if y is in the padding area between rows
      y % (height + padding) > padding
        ? Math.floor(y / (height + padding))
        : undefined
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
    const feature = layoutRow.find(
      (f) => bp >= f.location.start && bp <= f.location.end,
    )
    if (feature) {
      // TODO: check reversed
      // TODO: ensure feature is in interbase
      const startPx = (feature.location.start - region.start) / bpPerPx
      const endPx = (feature.location.end - region.start) / bpPerPx
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
        px:
          (apolloFeatureUnderMouse.location[overEdge] - region.start) / bpPerPx,
        bp: apolloFeatureUnderMouse.location[overEdge],
      })
    }
  }
  function onMouseUp() {
    if (dragging) {
      const assemblyId = getAssemblyId(region.assemblyName)
      const { feature, bp, edge } = dragging
      let change: Change
      if (edge === 'end') {
        const featureId = feature.id
        const oldEnd = feature.location.end
        const newEnd = Math.round(bp)
        change = new LocationEndChange({
          typeName: 'LocationEndChange',
          changedIds: [featureId],
          changes: [{ featureId, oldEnd, newEnd }],
          assemblyId,
        })
      } else {
        const featureId = feature.id
        const oldStart = feature.location.start
        const newStart = Math.round(bp)
        change = new LocationStartChange({
          typeName: 'LocationStartChange',
          changedIds: [featureId],
          changes: [{ featureId, oldStart, newStart }],
          assemblyId,
        })
      }
      changeManager?.submit(change)
    }
    setDragging(undefined)
  }
  return (
    <div style={{ position: 'relative', width: totalWidth, height }}>
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
