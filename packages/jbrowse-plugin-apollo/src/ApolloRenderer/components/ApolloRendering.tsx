import { Region } from '@jbrowse/core/util'
import { AnnotationFeatureI } from 'apollo-shared'
import { observer } from 'mobx-react'
import React, { useEffect, useRef } from 'react'

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
  const { regions, bpPerPx, displayModel } = props
  const [region] = regions
  const totalWidth = (region.end - region.start) / bpPerPx
  const {
    featureLayout,
    apolloFeatureUnderMouse,
    setApolloFeatureUnderMouse,
    apolloRowUnderMouse,
    setApolloRowUnderMouse,
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
    if (apolloFeatureUnderMouse && apolloRowUnderMouse !== undefined) {
      const start = apolloFeatureUnderMouse.location.start - region.start - 1
      const width = apolloFeatureUnderMouse.location.length
      const startPx = start / bpPerPx
      const widthPx = width / bpPerPx
      ctx.fillStyle = 'rgba(0,0,0,0.2)'
      ctx.fillRect(
        startPx,
        apolloRowUnderMouse * (height + 4) + padding,
        widthPx,
        height,
      )
    }
  }, [
    apolloFeatureUnderMouse,
    apolloRowUnderMouse,
    bpPerPx,
    totalHeight,
    totalWidth,
    region.start,
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
    setApolloFeatureUnderMouse(feature)
    setApolloRowUnderMouse(row)
  }
  function onMouseLeave() {
    setApolloFeatureUnderMouse(undefined)
    setApolloRowUnderMouse(undefined)
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
        style={{ position: 'absolute', left: 0, top: 0 }}
      />
    </div>
  )
}

export default observer(ApolloRendering)
