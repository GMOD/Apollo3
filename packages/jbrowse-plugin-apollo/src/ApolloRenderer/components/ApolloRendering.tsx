import { getConf } from '@jbrowse/core/configuration'
import { AppRootModel, Region, getSession } from '@jbrowse/core/util'
import { Menu, MenuItem } from '@mui/material'
import { AnnotationFeatureI } from 'apollo-mst'
import { LocationEndChange, LocationStartChange } from 'apollo-shared'
import { autorun, toJS } from 'mobx'
import { observer } from 'mobx-react'
import { getRoot, getSnapshot } from 'mobx-state-tree'
import React, { useEffect, useMemo, useRef, useState } from 'react'

import { ApolloInternetAccountModel } from '../../ApolloInternetAccount/model'
import { AddFeature } from '../../components/AddFeature'
import { CopyFeature } from '../../components/CopyFeature'
import { DeleteFeature } from '../../components/DeleteFeature'
import { LinearApolloDisplay } from '../../LinearApolloDisplay/stateModel'
import { Collaborator } from '../../session'

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
  const [isAdmin, setIsAdmin] = useState<boolean>(false)
  const [isReadOnly, setIsReadOnly] = useState<boolean>(true)
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

  const { regions, bpPerPx, displayModel } = props
  const session = getSession(displayModel)
  const { collaborators: collabs } = session

  // bridging mobx observability and React useEffect observability
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => autorun(() => setCollaborators(toJS(collabs))), [])

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

  const apolloInternetAccount = useMemo(() => {
    const { internetAccounts } = getRoot(session) as AppRootModel
    const { assemblyName } = region
    const { assemblyManager } = getSession(displayModel)
    const assembly = assemblyManager.get(assemblyName)
    if (!assembly) {
      throw new Error(`No assembly found with name ${assemblyName}`)
    }
    const { internetAccountConfigId } = getConf(assembly, [
      'sequence',
      'metadata',
    ]) as { internetAccountConfigId: string }
    const matchingAccount = internetAccounts.find(
      (ia) => getConf(ia, 'internetAccountId') === internetAccountConfigId,
    ) as ApolloInternetAccountModel | undefined
    if (!matchingAccount) {
      throw new Error(
        `No InternetAccount found with config id ${internetAccountConfigId}`,
      )
    }
    return matchingAccount
  }, [displayModel, region, session])

  const { authType, getRole } = apolloInternetAccount

  useEffect(() => {
    if (!authType) {
      return
    }
    if (getRole()?.includes('admin')) {
      setIsAdmin(true)
    }
    if (getRole()?.includes('admin') || getRole()?.includes('user')) {
      setIsReadOnly(false)
    }
  }, [authType, getRole])

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
        feature.draw(
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
    region,
    bpPerPx,
    region.start,
    region.end,
    region.reversed,
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
      const featureEdge = region.reversed
        ? region.end - feature[edge]
        : feature[edge] - region.start
      const featureEdgePx = featureEdge / bpPerPx
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
      const start = region.reversed
        ? region.end - feature.end
        : feature.start - region.start - 1
      const width = feature.length
      const startPx = start / bpPerPx
      const widthPx = width / bpPerPx
      ctx.fillStyle = 'rgba(0,0,0,0.2)'
      ctx.fillRect(startPx, row * height, widthPx, height * feature.rowCount)
    }
    for (const collaborator of collaborators) {
      const { locations } = collaborator
      console.log('000')
      console.log(JSON.stringify(locations))
      console.log(locations.length)
      if (!locations.length) {
        console.log('111')
        return
      }
      for (const location of locations) {
        console.log('AAA')
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
  }, [
    apolloFeatureUnderMouse,
    apolloRowUnderMouse,
    bpPerPx,
    totalHeight,
    totalWidth,
    region,
    region.start,
    region.end,
    region.reversed,
    dragging,
    height,
    collaborators,
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
          disabled={isReadOnly}
          key={1}
          value={1}
          onClick={() => {
            if (!contextMenuFeature) {
              return
            }
            const currentAssemblyId = getAssemblyId(region.assemblyName)
            session.queueDialog((doneCallback) => [
              AddFeature,
              {
                session,
                handleClose: () => {
                  doneCallback()
                  setContextMenuFeature(undefined)
                },
                changeManager,
                sourceFeature: contextMenuFeature,
                sourceAssemblyId: currentAssemblyId,
              },
            ])
          }}
        >
          Add child feature
        </MenuItem>
        <MenuItem
          disabled={isReadOnly}
          key={2}
          value={2}
          onClick={() => {
            if (!contextMenuFeature) {
              return
            }
            const currentAssemblyId = getAssemblyId(region.assemblyName)
            session.queueDialog((doneCallback) => [
              CopyFeature,
              {
                session,
                handleClose: () => {
                  doneCallback()
                  setContextMenuFeature(undefined)
                },
                changeManager,
                sourceFeatureId: contextMenuFeature?._id,
                sourceAssemblyId: currentAssemblyId,
              },
            ])
          }}
        >
          Copy features and annotations
        </MenuItem>
        <MenuItem
          disabled={!isAdmin}
          key={3}
          value={3}
          onClick={() => {
            if (!contextMenuFeature) {
              return
            }
            const currentAssemblyId = getAssemblyId(region.assemblyName)
            session.queueDialog((doneCallback) => [
              DeleteFeature,
              {
                session,
                handleClose: () => {
                  doneCallback()
                  setContextMenuFeature(undefined)
                },
                changeManager,
                sourceFeature: contextMenuFeature,
                sourceAssemblyId: currentAssemblyId,
                selectedFeature,
                setSelectedFeature,
              },
            ])
          }}
        >
          Delete feature
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
