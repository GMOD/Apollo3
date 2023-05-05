import { Region, getSession, isContainedWithin } from '@jbrowse/core/util'
import { AnnotationFeatureI } from 'apollo-mst'
import { LocationEndChange, LocationStartChange } from 'apollo-shared'
import { autorun, toJS } from 'mobx'
import { observer } from 'mobx-react'
import { getSnapshot } from 'mobx-state-tree'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { makeStyles } from 'tss-react/mui'

import { LinearApolloDisplay } from '../../LinearApolloDisplay/stateModel'
import { Collaborator } from '../../session'
import {
  draw,
  getFeatureFromLayout,
  getFeatureRowCount,
} from './featureDrawing'

interface ApolloRenderingProps {
  assemblyName: string
  regions: Region[]
  bpPerPx: number
  displayModel: LinearApolloDisplay
  blockKey: string
}

const useStyles = makeStyles()((theme) => ({
  canvas: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  canvasContainer: {
    position: 'relative',
  },
}))

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
  const [movedDuringLastMouseDown, setMovedDuringLastMouseDown] =
    useState(false)
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const { classes } = useStyles()

  const { regions, bpPerPx, displayModel } = props
  const session = getSession(displayModel)
  const { collaborators: collabs } = session

  // bridging mobx observability and React useEffect observability
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => autorun(() => setCollaborators(toJS(collabs))), [])

  const [region] = regions
  const totalWidth = (region.end - region.start) / bpPerPx
  const {
    featureLayouts,
    displayedRegions,
    apolloFeatureUnderMouse,
    setApolloFeatureUnderMouse,
    apolloRowUnderMouse,
    setApolloRowUnderMouse,
    setApolloContextMenuFeature,
    changeManager,
    getAssemblyId,
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

  const featureLayout = useMemo(() => {
    const featureLayoutIndex = displayedRegions.findIndex(
      (displayedRegion) =>
        region.refName === displayedRegion.refName &&
        isContainedWithin(
          region.start,
          region.end,
          displayedRegion.start,
          displayedRegion.end,
        ),
    )
    return featureLayoutIndex === -1
      ? featureLayouts[0]
      : featureLayouts[featureLayoutIndex]
  }, [
    displayedRegions,
    featureLayouts,
    region.end,
    region.start,
    region.refName,
  ])
  // this useEffect draws the features
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
        const start = region.reversed
          ? region.end - feature.end
          : feature.start - region.start - 1
        const startPx = start / bpPerPx
        draw(
          feature,
          ctx,
          startPx,
          row * height,
          bpPerPx,
          height,
          region.reversed,
        )
      }
    }
  }, [
    bpPerPx,
    region.start,
    region.end,
    region.reversed,
    totalWidth,
    featureLayout,
    totalHeight,
    height,
    featureSnap,
  ])
  // this useEffect draws the dragging indicators
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
      const rowCount = getFeatureRowCount(feature)
      const featureEdge = region.reversed
        ? region.end - feature[edge]
        : feature[edge] - region.start
      const featureEdgePx = featureEdge / bpPerPx
      const startPx = Math.min(px, featureEdgePx)
      const widthPx = Math.abs(px - featureEdgePx)
      ctx.strokeStyle = 'red'
      ctx.setLineDash([6])
      ctx.strokeRect(startPx, row * height, widthPx, height * rowCount)
      ctx.fillStyle = 'rgba(255,0,0,.2)'
      ctx.fillRect(startPx, row * height, widthPx, height * rowCount)
    }
    const feature = dragging?.feature || apolloFeatureUnderMouse
    const row = dragging?.row || apolloRowUnderMouse
    if (feature && row !== undefined) {
      const rowCount = getFeatureRowCount(feature)
      const start = region.reversed
        ? region.end - feature.end
        : feature.start - region.start - 1
      const width = feature.length
      const startPx = start / bpPerPx
      const widthPx = width / bpPerPx
      ctx.fillStyle = 'rgba(0,0,0,0.2)'
      ctx.fillRect(startPx, row * height, widthPx, height * rowCount)
    }
  }, [
    apolloFeatureUnderMouse,
    apolloRowUnderMouse,
    bpPerPx,
    totalHeight,
    totalWidth,
    region.start,
    region.end,
    region.reversed,
    dragging,
    height,
  ])
  // this useEffect draws the collaborator positions
  useEffect(() => {
    const canvas = overlayCanvasRef.current
    if (!canvas) {
      return
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }
    for (const collaborator of collaborators) {
      const { locations } = collaborator
      if (!locations.length) {
        return
      }
      for (const location of locations) {
        const { start, end } = location
        const locationStart = region.reversed
          ? region.end - start
          : start - region.start
        const locationStartPx = locationStart / bpPerPx
        const locationWidthPx = (end - start) / bpPerPx
        ctx.fillStyle = 'rgba(0,255,0,.2)'
        ctx.fillRect(locationStartPx, 1, locationWidthPx, 100)
        ctx.fillStyle = 'black'
        ctx.fillText(
          collaborator.name,
          locationStartPx + 1,
          11,
          locationWidthPx - 2,
        )
      }
    }
  }, [bpPerPx, collaborators, region.end, region.start, region.reversed])

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
    x = region.reversed ? totalWidth - x : x
    const y = clientY - top

    if (dragging) {
      const { edge, feature, row } = dragging
      let px = region.reversed ? totalWidth - x : x
      let bp = region.start + x * bpPerPx
      if (edge === 'start' && bp > feature.end - 1) {
        bp = feature.end - 1
        px = (region.reversed ? region.end - bp : bp - region.start) / bpPerPx
      } else if (edge === 'end' && bp < feature.start + 1) {
        bp = feature.start + 1
        px = (region.reversed ? region.end - bp : bp - region.start) / bpPerPx
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
      feature = getFeatureFromLayout(
        feature,
        thisX,
        y - topRow * height,
        bpPerPx,
        height,
      )
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
      const { clientX } = event
      const { left } = canvasRef.current?.getBoundingClientRect() || {
        left: 0,
        top: 0,
      }
      const px = clientX - left
      event.stopPropagation()
      setDragging({
        edge: overEdge,
        feature: apolloFeatureUnderMouse,
        row: apolloRowUnderMouse || 0,
        px,
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
      const assembly = getAssemblyId(region.assemblyName)
      const { feature, bp, edge } = dragging
      let change: LocationEndChange | LocationStartChange
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
          assembly,
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
          assembly,
        })
      }
      changeManager?.submit(change)
    }
    setDragging(undefined)
    setMovedDuringLastMouseDown(false)
  }
  function onContextMenu(event: React.MouseEvent) {
    event.preventDefault()
    setApolloContextMenuFeature(apolloFeatureUnderMouse)
  }

  return (
    <div
      className={classes.canvasContainer}
      style={{ width: totalWidth, height: totalHeight }}
    >
      <canvas
        ref={canvasRef}
        width={totalWidth}
        height={totalHeight}
        className={classes.canvas}
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
        className={classes.canvas}
        style={{
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
