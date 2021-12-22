import { Region } from '@jbrowse/core/util'
import { observer } from 'mobx-react'
import { Instance } from 'mobx-state-tree'
import React, { useEffect, useRef } from 'react'

import { AnnotationFeatureI } from '../../AnnotationDrivers/AnnotationFeature'
import { rectangle } from '../../LinearApolloDisplay/GranularRectLayout'
import { LinearApolloDisplay } from '../../LinearApolloDisplay/stateModel'

interface ApolloRenderingProps {
  features: Map<string, Map<string, Map<string, AnnotationFeatureI>>>
  assemblyName: string
  regions: Region[]
  bpPerPx: number
  displayModel: LinearApolloDisplay
  blockKey: string
  onMouseMove: (
    event: React.MouseEvent,
    rectId: string | undefined,
    onBorder: boolean,
  ) => void
  onMouseLeave: (event: React.MouseEvent) => void
  onRectClick: (
    event: React.MouseEvent,
    rectId: string | undefined,
    onBorder: boolean,
  ) => void
}

function ApolloRendering(props: ApolloRenderingProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ref = useRef<HTMLDivElement>(null)
  const {
    regions,
    bpPerPx,
    displayModel,
    onMouseMove,
    onMouseLeave,
    onRectClick,
  } = props
  const [region] = regions
  const totalWidth = (region.end - region.start) / bpPerPx
  // gets layout here and draws
  const { layout } = displayModel
  // const { featureLayout, featuresForBlock } = displayModel
  // const features = featuresForBlock[blockKey]
  let totalHeight = 0 // instead of 0, totalHeight = layout.totalHeight
  if (layout) {
    Array.from(layout.rectangles.entries()).map(([id, rect]) => {
      const { top } = rect
      if (top && top > totalHeight) {
        totalHeight = top
      }
      return totalHeight
    })
  }
  useEffect(() => {
    if (!layout || !layout.rectangles) {
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
    // it's trying to rerender every time a rectangle gets added
    layout.rectangles.forEach((rect) => {
      const startPx = rect.l - region.start / bpPerPx
      const widthPx = rect.r - rect.l
      const { h } = rect
      ctx.fillStyle = 'black'
      ctx.fillRect(startPx, (rect.top || 0) + 2, widthPx, h - 4)
      ctx.fillStyle = '#F5CBA7'
      ctx.fillRect(startPx + 1, (rect.top || 0) + 3, widthPx - 2, h - 6)
    })
  }, [bpPerPx, layout, totalHeight, region.start, totalWidth])

  function getRectangleUnderMouse(eventClientX: number) {
    let offset = 0
    if (ref.current) {
      offset = ref.current.getBoundingClientRect().left
    }
    const offsetX = eventClientX - offset
    const px = region.reversed
      ? (region.end - region.start) / bpPerPx - offset
      : offsetX

    let rectangleUnderMouse: Instance<typeof rectangle> | undefined
    if (layout) {
      // probably need to determine height too
      Array.from(layout.rectangles.entries()).forEach(([id, rect]) => {
        if (px >= rect.l - region.start / bpPerPx && px <= rect.r) {
          rectangleUnderMouse = rect
        }
      })
    }
    return rectangleUnderMouse
  }

  function getRectangleBorderUnderMouse(
    eventClientX: number,
    rectangleUnderMouse?: Instance<typeof rectangle>,
  ) {
    let offset = 0
    if (ref.current) {
      offset = ref.current.getBoundingClientRect().left
    }
    const offsetX = eventClientX - offset
    const px = region.reversed
      ? (region.end - region.start) / bpPerPx - offset
      : offsetX

    if (layout && rectangleUnderMouse) {
      console.log(
        'checking',
        px,
        bpPerPx,
        region.start,
        rectangleUnderMouse.l - region.start,
        rectangleUnderMouse.l - region.start + 30,
        rectangleUnderMouse.r,
        rectangleUnderMouse.r - 30,
        px >= rectangleUnderMouse.l - region.start / bpPerPx,
        px <= rectangleUnderMouse.l - region.start / bpPerPx + 30,
        px <= rectangleUnderMouse.r,
        px >= rectangleUnderMouse.r - 30,
      )
      if (
        (px >= rectangleUnderMouse.l - region.start / bpPerPx &&
          px <= rectangleUnderMouse.l - region.start / bpPerPx + 30) ||
        (px <= rectangleUnderMouse.r && px >= rectangleUnderMouse.r - 30)
      ) {
        return true
      }
    }
    return false
  }
  return (
    <canvas
      ref={canvasRef}
      width={totalWidth}
      height={totalHeight}
      onMouseMove={(event) => {
        const rectUnderMouse = getRectangleUnderMouse(event.clientX)
        const onBorder = getRectangleBorderUnderMouse(
          event.clientX,
          rectUnderMouse,
        )
        console.log('mouse moving', rectUnderMouse?.id, onBorder)
        onMouseMove(
          event,
          rectUnderMouse ? rectUnderMouse.id : undefined,
          onBorder,
        )
      }}
      onClick={(event) => {
        const rectUnderMouse = getRectangleUnderMouse(event.clientX)
        const onBorder = getRectangleBorderUnderMouse(
          event.clientX,
          rectUnderMouse,
        )
        onRectClick(
          event,
          rectUnderMouse ? rectUnderMouse.id : undefined,
          onBorder,
        )
      }}
      onMouseLeave={(event) => onMouseLeave(event)}
    />
  )
}

export default observer(ApolloRendering)
