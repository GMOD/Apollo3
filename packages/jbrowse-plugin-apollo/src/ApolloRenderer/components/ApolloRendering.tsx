import { Region } from '@jbrowse/core/util'
import { observer } from 'mobx-react'
import React, { useEffect, useRef } from 'react'

import { AnnotationFeatureI } from '../../AnnotationDrivers/AnnotationFeature'
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
  const { regions, bpPerPx, displayModel, blockKey } = props
  const [region] = regions
  const totalWidth = (region.end - region.start) / bpPerPx
  // gets layout here and draws
  const { layout } = displayModel
  const { featureLayout, featuresForBlock } = displayModel
  const features = featuresForBlock[blockKey]
  const height = 20
  const padding = 4
  const highestRow = Math.max(...Array.from(Object.values(featureLayout)))
  const totalHeight = highestRow * (height + padding)
  useEffect(() => {
    if (!features) {
      return
    }
    if (!layout || !layout.bitmap) {
      return
    }
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }
    ctx.clearRect(0, 0, totalWidth, totalHeight)
    layout.rectangles.forEach((rectangle) => {
      const startPx = rectangle.l / bpPerPx
      const widthPx = (rectangle.r - rectangle.l) / bpPerPx
      const { h } = rectangle
      console.log('rect', rectangle.id, startPx, rectangle.top, widthPx, h)
      // current drawing problem, start width and height are off by a factor of 10, top is always 0
      // ctx.fillStyle = 'black'
      // ctx.fillRect(startPx, rectangle.top || 0, widthPx, h)
      // ctx.fillStyle = '#F5CBA7'
      // ctx.fillRect(startPx + 1, rectangle.top || 0 + 1, widthPx - 2, h - 2)
    })
    features.forEach((feature) => {
      const row = featureLayout[feature.id]
      if (row === undefined) {
        throw new Error('no layout')
      }
      const start = feature.location.start - region.start
      const width = feature.location.length
      const startPx = start / bpPerPx
      const widthPx = width / bpPerPx
      console.log(
        'og drawing',
        feature.id,
        startPx,
        row * (height + 4),
        widthPx,
        height,
      )
      ctx.fillStyle = 'black'
      ctx.fillRect(startPx, row * (height + 4), widthPx, height)
      // when changing to  GRL, itll just be ctx.fillREct(start, top, witdth, height)
      ctx.fillStyle = '#F5CBA7'
      ctx.fillRect(
        startPx + 1,
        row * (height + padding) + 1,
        widthPx - 2,
        height - 2,
      )
    })
  }, [
    bpPerPx,
    features,
    layout,
    region.start,
    totalWidth,
    featureLayout,
    highestRow,
    totalHeight,
  ])
  return <canvas ref={canvasRef} width={totalWidth} height={totalHeight} />
}

export default observer(ApolloRendering)
