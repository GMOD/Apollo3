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
  let totalHeight = 0
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
      ctx.fillRect(startPx, rect.top || 0, widthPx, h)
      ctx.fillStyle = '#F5CBA7'
      ctx.fillRect(startPx + 1, (rect.top || 0) + 1, widthPx - 2, h - 2)
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
    const clientBp = region.start + bpPerPx * px
    let rectangleUnderMouse: Instance<typeof rectangle> | undefined
    if (layout) {
      Array.from(layout.rectangles.entries()).forEach(([id, rect]) => {
        if (
          clientBp <= (rect.l - region.start / bpPerPx) * bpPerPx &&
          clientBp >= (rect.r - rect.l) * bpPerPx
        ) {
          rectangleUnderMouse = rect
        }
      })
    }
    console.log(offset, offsetX, clientBp, rectangleUnderMouse)
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
    const clientBp = region.start + bpPerPx * px

    if (layout && rectangleUnderMouse) {
      if (
        clientBp ===
          (rectangleUnderMouse.l - region.start / bpPerPx) * bpPerPx ||
        clientBp === (rectangleUnderMouse.r - rectangleUnderMouse.l) * bpPerPx
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
        console.log('mouse moving', rectUnderMouse, onBorder)
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
