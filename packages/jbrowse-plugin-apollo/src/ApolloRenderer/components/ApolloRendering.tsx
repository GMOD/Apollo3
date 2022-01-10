import { Region } from '@jbrowse/core/util'
import { observer } from 'mobx-react'
import { Instance } from 'mobx-state-tree'
import React, { useEffect, useRef, useState } from 'react'

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

  const [onBorder, setOnBorder] = useState(false)
  const [mouseDragging, setMouseDragging] = useState(false)
  // const { featureLayout, featuresForBlock } = displayModel
  // const features = featuresForBlock[blockKey]
  let { totalHeight } = layout // instead of 0, totalHeight = layout.totalHeight
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
      ctx.fillRect(startPx, (rect.top || 0) * 20 + 2, widthPx, h * 20 - 4)
      ctx.fillStyle = '#F5CBA7'
      ctx.fillRect(
        startPx + 1,
        (rect.top || 0) * 20 + 3,
        widthPx - 2,
        h * 20 - 6,
      )
    })
  }, [bpPerPx, layout, totalHeight, region.start, totalWidth])

  function getRectangleUnderMouse(eventClientX: number, eventClientY: number) {
    let offsetX = 0
    let offsetY = 0
    if (canvasRef.current) {
      offsetX = canvasRef.current.getBoundingClientRect().left
      offsetY = canvasRef.current.getBoundingClientRect().top
    }
    offsetX = eventClientX - offsetX
    offsetY = eventClientY - offsetY
    const px = region.reversed
      ? (region.end - region.start) / bpPerPx - offsetX
      : offsetX

    let rectangleUnderMouse: Instance<typeof rectangle> | undefined
    if (layout) {
      // probably need to determine height too
      const rectArray = Array.from(layout.rectangles.entries())
      for (const rect of rectArray) {
        const [id, rectInfo] = rect
        if (
          px >= rectInfo.l - region.start / bpPerPx &&
          px <= rectInfo.r &&
          (rectInfo.top || 0) * 20 <= offsetY &&
          (rectInfo.top || 0) * 20 + rectInfo.h * 20 >= offsetY
        ) {
          rectangleUnderMouse = rectInfo
          break
        }
      }
    }
    return rectangleUnderMouse
  }

  function getRectangleBorderUnderMouse(
    eventClientX: number,
    eventClientY: number,
    rectangleUnderMouse?: Instance<typeof rectangle>,
  ) {
    let offsetX = 0
    let offsetY = 0
    if (canvasRef.current) {
      offsetX = canvasRef.current.getBoundingClientRect().left
      offsetY = canvasRef.current.getBoundingClientRect().top
    }
    offsetX = eventClientX - offsetX
    offsetY = eventClientY - offsetY
    const px = region.reversed
      ? (region.end - region.start) / bpPerPx - offsetX
      : offsetX

    if (
      layout &&
      rectangleUnderMouse &&
      (rectangleUnderMouse.top || 0) * 20 <= offsetY &&
      (rectangleUnderMouse.top || 0) * 20 + rectangleUnderMouse.h * 20 >=
        offsetY
    ) {
      if (
        (px >= rectangleUnderMouse.l - region.start / bpPerPx &&
          px <= rectangleUnderMouse.l - region.start / bpPerPx + 3) ||
        (px <= rectangleUnderMouse.r && px >= rectangleUnderMouse.r - 3)
      ) {
        return true
      }
    }
    return false
  }

  function recordPxPosition(eventClientX: number, eventClientY: number) {
    let offsetX = 0
    let offsetY = 0
    if (canvasRef.current) {
      offsetX = canvasRef.current.getBoundingClientRect().left
      offsetY = canvasRef.current.getBoundingClientRect().top
    }
    offsetX = eventClientX - offsetX
    offsetY = eventClientY - offsetY
    const px = region.reversed
      ? (region.end - region.start) / bpPerPx - offsetX
      : offsetX

    return { px, py: offsetY }
  }
  return (
    <canvas
      ref={canvasRef}
      width={totalWidth}
      height={totalHeight * 20}
      style={{
        cursor: onBorder ? 'col-resize' : 'default',
        pointerEvents: 'none',
      }}
      onMouseMove={(event) => {
        const rectUnderMouse = getRectangleUnderMouse(
          event.clientX,
          event.clientY,
        )
        setOnBorder(
          getRectangleBorderUnderMouse(
            event.clientX,
            event.clientY,
            rectUnderMouse,
          ),
        )
        console.log('mouse moving', rectUnderMouse?.id, onBorder)
        onMouseMove(
          event,
          rectUnderMouse ? rectUnderMouse.id : undefined,
          onBorder,
        )
      }}
      onMouseDown={(event) => {
        event.preventDefault()
        setMouseDragging(true)
        console.log('down')
        if (onBorder) {
          console.log('onBorder')
          const rectUnderMouse = getRectangleUnderMouse(
            event.clientX,
            event.clientY,
          )
          const px = recordPxPosition(event.clientX, event.clientY)
          console.log(px)
        }
      }}
      // onClick={(event) => {
      //   const rectUnderMouse = getRectangleUnderMouse(
      //     event.clientX,
      //     event.clientY,
      //   )
      //   setOnBorder(
      //     getRectangleBorderUnderMouse(
      //       event.clientX,
      //       event.clientY,
      //       rectUnderMouse,
      //     ),
      //   )
      //   onRectClick(
      //     event,
      //     rectUnderMouse ? rectUnderMouse.id : undefined,
      //     onBorder,
      //   )
      // }}
      onMouseLeave={(event) => onMouseLeave(event)}
    />
  )
}

export default observer(ApolloRendering)
