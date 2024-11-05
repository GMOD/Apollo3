/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/no-misused-promises */
import { AnnotationFeature } from '@apollo-annotation/mst'
import {
  LocationEndChange,
  LocationStartChange,
} from '@apollo-annotation/shared'
import { getConf } from '@jbrowse/core/configuration'
import { AbstractSessionModel, Region, getSession } from '@jbrowse/core/util'
import { Menu, MenuItem } from '@mui/material'
import { autorun, toJS } from 'mobx'
import { observer } from 'mobx-react'
import { getRoot, getSnapshot } from 'mobx-state-tree'
import React, { useEffect, useMemo, useRef, useState } from 'react'

import { ApolloInternetAccountModel } from '../../ApolloInternetAccount/model'
import { AddChildFeature } from '../../components/AddChildFeature'
import { CopyFeature } from '../../components/CopyFeature'
import { DeleteFeature } from '../../components/DeleteFeature'
import { Collaborator } from '../../session'
import { SixFrameFeatureDisplay } from '../../SixFrameFeatureDisplay/stateModel'
import { ApolloRootModel } from '../../types'

interface ApolloRenderingProps {
  assemblyName: string
  regions: Region[]
  bpPerPx: number
  displayModel: SixFrameFeatureDisplay
  blockKey: string
}

function draw(
  ctx: CanvasRenderingContext2D,
  xOffset: number,
  yOffset: number,
  width: number,
  bpPerPx: number,
  rowHeight: number,
) {
  const widthPx = width / bpPerPx
  ctx.fillStyle = 'black'
  ctx.fillRect(xOffset, yOffset, widthPx, rowHeight)
  if (widthPx > 2) {
    ctx.clearRect(xOffset + 1, yOffset + 1, widthPx - 2, rowHeight - 2)
    ctx.fillStyle = 'rgba(255,255,255,0.75)'
    ctx.fillRect(xOffset + 1, yOffset + 1, widthPx - 2, rowHeight - 2)
    // ctx.fillStyle = 'black'
    // ctx.fillText(
    //     'CDS',
    //     xOffset + startPx + 1,
    //     yOffset + 11,
    //     widthPx - 2,
    //   )
  }
}

type Coord = [number, number]

/**
 * Use the golden ratio to generate distinct colors for a given integer
 * See https://martin.ankerl.com/2009/12/09/how-to-create-random-colors-programmatically/
 * @param number -
 * @returns HSL string
 */
function selectColor(number: number) {
  const goldenAngle = 180 * (3 - Math.sqrt(5))
  const hue = number * goldenAngle + 60
  return `hsl(${hue},100%,50%)`
}

function ApolloRendering(props: ApolloRenderingProps) {
  const [contextCoord, setContextCoord] = useState<Coord>()
  const [contextMenuFeature, setContextMenuFeature] =
    useState<AnnotationFeature>()

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
  const codonCanvasRef = useRef<HTMLCanvasElement>(null)
  const [isAdmin, setIsAdmin] = useState<boolean>(false)
  const [isReadOnly, setIsReadOnly] = useState<boolean>(true)
  // const [overEdge, setOverEdge] = useState<'start' | 'end'>()
  const [dragging, setDragging] = useState<{
    edge: 'start' | 'end'
    feature: AnnotationFeature
    row: number
    bp: number
    px: number
  }>()
  const [movedDuringLastMouseDown, setMovedDuringLastMouseDown] =
    useState(false)
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])

  const { bpPerPx, displayModel, regions } = props
  const { session } = displayModel
  const { collaborators: collabs } = session

  // bridging mobx observability and React useEffect observability

  useEffect(
    () =>
      autorun(() => {
        setCollaborators(toJS(collabs))
      }),
    [],
  )

  const [totalHeight, setTotalHeight] = useState<number>()
  useEffect(() => {
    async function getTotalHeight() {
      const totalHeight = await displayModel.getFeaturesHeight()
      setTotalHeight(totalHeight)
    }
    void getTotalHeight()
  })

  const [featureLayout, setFeatureLayout] =
    useState<Map<number, [string, AnnotationFeature][]>>()
  useEffect(() => {
    async function getFeatureLayout() {
      const featureLayout = await displayModel.getFeatureLayout()
      setFeatureLayout(featureLayout)
    }
    void getFeatureLayout()
  })

  const [region] = regions
  const totalWidth = (region.end - region.start) / bpPerPx
  const {
    apolloFeatureUnderMouse,
    apolloRowHeight: height,
    apolloRowUnderMouse,
    changeManager,
    codonLayout,
    features,
    getAssemblyId,
    selectedFeature,
    setApolloFeatureUnderMouse,
    setApolloRowUnderMouse,
    setSelectedFeature,
    showIntronLines: showLines,
    showStartCodons: showStarts,
    showStopCodons: showStops,
  } = displayModel
  // const featureLayout = await displayModel.getFeatureLayout()
  // const totalHeight = await displayModel.getFeaturesHeight()

  // use this to convince useEffect that the features really did change
  const featureSnap = [...features.values()].map((a) =>
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    [...a.values()].map((f) => getSnapshot(f)),
  )

  const apolloInternetAccount = useMemo(() => {
    const { internetAccounts } = getRoot<ApolloRootModel>(session)
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

  const { role } = apolloInternetAccount

  useEffect(() => {
    if (role?.includes('admin')) {
      setIsAdmin(true)
    }
    if (role?.includes('admin') ?? role?.includes('user')) {
      setIsReadOnly(false)
    }
  }, [role])

  useEffect(() => {
    // if (!isAlive(region)) {
    //   return
    // }
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }
    if (!totalHeight) {
      return
    }
    if (!featureLayout) {
      return
    }

    async function getFeatureLayout() {
      const featureLayout = await displayModel.getFeatureLayout()
      setFeatureLayout(featureLayout)
    }
    void getFeatureLayout()

    const transcript: Record<string, [number, number][]> = {}
    ctx.clearRect(0, 0, totalWidth, totalHeight)
    for (const [row, featureInfos] of featureLayout) {
      for (const [parentID, feature] of featureInfos) {
        const start = region.reversed
          ? region.end - feature.max
          : feature.min - region.start - 1
        const end = feature.max - region.start - 1
        const startPx = start / bpPerPx
        const endPx = end / bpPerPx
        const width = end - start
        draw(ctx, startPx, row * height, width, bpPerPx, height)
        const lineY = row * height + height / 2
        if (!transcript[parentID]) {
          transcript[parentID] = []
        }
        if (
          !transcript[parentID].some(
            (el) => el[0] === startPx && el[1] === lineY,
          )
        ) {
          transcript[parentID].push([startPx, lineY])
        }
        if (
          !transcript[parentID].some((el) => el[0] === endPx && el[1] === lineY)
        ) {
          transcript[parentID].push([endPx, lineY])
        }
      }
    }
    if (showLines) {
      let offset = -Math.floor(Object.keys(transcript).length / 2)
      for (const pid in transcript) {
        ctx.strokeStyle = selectColor(offset)
        const sortedCoords = transcript[pid].sort((a, b) => {
          return a[0] - b[0]
        })
        let [prevCoords] = sortedCoords
        for (const [index, coords] of sortedCoords.entries()) {
          if (index === 0) {
            continue
          }
          if (index % 2 === 0) {
            /** Mid-point for intron line "hat" */
            const midPoint: [number, number] = [
              (coords[0] - prevCoords[0]) / 2 + prevCoords[0],
              Math.max(
                1, // Avoid render ceiling
                Math.min(prevCoords[1], coords[1]) - height / 2 + offset * 2,
              ),
            ]
            ctx.beginPath()
            ctx.moveTo(prevCoords[0], prevCoords[1] + offset * 2)
            ctx.lineTo(...midPoint)
            ctx.stroke()
            ctx.moveTo(...midPoint)
            ctx.lineTo(coords[0], coords[1] + offset * 2)
            ctx.stroke()
          }
          prevCoords = coords
        }
        offset += 1
      }
    }
  }, [
    showLines,
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
    // if (!isAlive(region)) {
    //   return
    // }
    const canvas = codonCanvasRef.current
    if (!canvas) {
      return
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }
    if (!totalHeight) {
      return
    }

    ctx.clearRect(0, 0, totalWidth, totalHeight)
    for (const [row, { starts, stops }] of codonLayout) {
      const scale = bpPerPx
      for (const start of starts) {
        const x = start / scale
        if (region.start / scale <= x && x <= region.end / scale) {
          ctx.fillStyle = 'rgba(255,0,255,1)'
          if (showStarts) {
            ctx.fillRect(
              Math.round(x - 0.5 - region.start / scale),
              row * height,
              1,
              height,
            )
          } else {
            ctx.clearRect(
              Math.round(x - 0.5 - region.start / scale),
              row * height,
              1,
              height,
            )
          }
        }
      }
      for (const start of stops) {
        const x = start / scale
        if (region.start / scale <= x && x <= region.end / scale) {
          ctx.fillStyle = 'black'
          if (showStops) {
            ctx.fillRect(
              Math.round(x - 0.5 - region.start / scale),
              row * height,
              1,
              height,
            )
          } else {
            ctx.clearRect(
              Math.round(x - 0.5 - region.start / scale),
              row * height,
              1,
              height,
            )
          }
        }
      }
    }
  }, [
    showStarts,
    showStops,
    codonLayout,
    totalWidth,
    totalHeight,
    bpPerPx,
    height,
    region,
    region.start,
    region.end,
  ])

  useEffect(() => {
    // if (!isAlive(region)) {
    //   return
    // }
    const canvas = overlayCanvasRef.current
    if (!canvas) {
      return
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }
    if (!totalHeight) {
      return
    }
    ctx.clearRect(0, 0, totalWidth, totalHeight)
    // if (dragging) {
    //   const { feature, row, edge, px } = dragging
    //   const featureEdge = region.reversed
    //     ? region.end - feature[edge]
    //     : feature[edge] - region.start
    //   const featureEdgePx = featureEdge / bpPerPx
    //   const startPx = Math.min(px, featureEdgePx)
    //   const widthPx = Math.abs(px - featureEdgePx)
    //   ctx.strokeStyle = 'red'
    //   ctx.setLineDash([6])
    //   ctx.strokeRect(startPx, row * height, widthPx, height * feature.rowCount)
    //   ctx.fillStyle = 'rgba(255,0,0,.2)'
    //   ctx.fillRect(startPx, row * height, widthPx, height * feature.rowCount)
    // }
    // const feature = dragging?.feature || apolloFeatureUnderMouse
    // const row = dragging?.row || apolloRowUnderMouse
    // if (feature && row !== undefined) {
    //   const start = region.reversed
    //     ? region.end - feature.end
    //     : feature.start - region.start - 1
    //   const width = feature.length
    //   const startPx = start / bpPerPx
    //   const widthPx = width / bpPerPx
    //   ctx.fillStyle = 'rgba(0,0,0,0.2)'
    //   ctx.fillRect(startPx, row * height, widthPx, height * feature.rowCount)
    // }
    for (const collaborator of collaborators) {
      const { locations } = collaborator
      if (locations.length === 0) {
        return
      }
      for (const location of locations) {
        const { end, start } = location
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

  // function onMouseMove(event: React.MouseEvent<HTMLCanvasElement, MouseEvent>) {
  //   // if (!isAlive(region)) {
  //   //   return
  //   // }
  //   const { clientX, clientY, buttons } = event
  //   if (!movedDuringLastMouseDown && buttons === 1) {
  //     setMovedDuringLastMouseDown(true)
  //   }
  //   const { left, top } = canvasRef.current?.getBoundingClientRect() || {
  //     left: 0,
  //     top: 0,
  //   }
  //   // get pixel coordinates within the whole canvas
  //   let x = clientX - left
  //   x = region.reversed ? totalWidth - x : x
  //   const y = clientY - top

  //   if (dragging) {
  //     const { edge, feature, row } = dragging
  //     let px = region.reversed ? totalWidth - x : x
  //     let bp = region.start + x * bpPerPx
  //     if (edge === 'start' && bp > feature.end - 1) {
  //       bp = feature.end - 1
  //       px = (region.reversed ? region.end - bp : bp - region.start) / bpPerPx
  //     } else if (edge === 'end' && bp < feature.start + 1) {
  //       bp = feature.start + 1
  //       px = (region.reversed ? region.end - bp : bp - region.start) / bpPerPx
  //     }
  //     setDragging({
  //       edge,
  //       feature,
  //       row,
  //       px,
  //       bp,
  //     })
  //     return
  //   }

  //   const row = Math.floor(y / height)
  //   if (row === undefined) {
  //     setApolloFeatureUnderMouse(undefined)
  //     setApolloRowUnderMouse(undefined)
  //     return
  //   }
  //   const layoutRow = featureLayout.get(row)
  //   if (!layoutRow) {
  //     setApolloFeatureUnderMouse(undefined)
  //     setApolloRowUnderMouse(undefined)
  //     return
  //   }
  //   const bp = region.start + bpPerPx * x
  //   // eslint-disable-next-line @typescript-eslint/no-unused-vars
  //   const [parentID, feat] =
  //     layoutRow.find((f) => bp >= f[1].min && bp <= f[1].max) || []
  //   let feature: AnnotationFeature | undefined = feat
  //   if (feature) {
  //     const topRow = row
  //     const startPx = (feature.start - region.start) / bpPerPx
  //     const thisX = x - startPx
  //     feature = feature.getFeatureFromLayout(
  //       thisX,
  //       y - topRow * height,
  //       bpPerPx,
  //       height,
  //     ) as AnnotationFeature
  //   }
  //   if (feature) {
  //     // TODO: check reversed
  //     // TODO: ensure feature is in interbase
  //     const startPx = (feature.start - region.start) / bpPerPx
  //     const endPx = (feature.end - region.start) / bpPerPx
  //     if (endPx - startPx < 8) {
  //       setOverEdge(undefined)
  //     } else if (Math.abs(startPx - x) < 4) {
  //       setOverEdge('start')
  //     } else if (Math.abs(endPx - x) < 4) {
  //       setOverEdge('end')
  //     } else {
  //       setOverEdge(undefined)
  //     }
  //   }
  //   setApolloFeatureUnderMouse(feature)
  //   setApolloRowUnderMouse(row)
  // }
  function onMouseLeave() {
    setApolloFeatureUnderMouse()
    setApolloRowUnderMouse()
  }
  // function onMouseDown(event: React.MouseEvent) {
  //   if (apolloFeatureUnderMouse && overEdge) {
  //     const { clientX } = event
  //     const { left } = canvasRef.current?.getBoundingClientRect() || {
  //       left: 0,
  //       top: 0,
  //     }
  //     const px = clientX - left
  //     event.stopPropagation()
  //     setDragging({
  //       edge: overEdge,
  //       feature: apolloFeatureUnderMouse,
  //       row: apolloRowUnderMouse || 0,
  //       px,
  //       bp: apolloFeatureUnderMouse[overEdge],
  //     })
  //   }
  // }
  async function onMouseUp() {
    if (!movedDuringLastMouseDown) {
      if (apolloFeatureUnderMouse) {
        setSelectedFeature(apolloFeatureUnderMouse)
      }
    } else if (dragging) {
      const assembly = getAssemblyId(region.assemblyName)
      const { bp, edge, feature } = dragging
      let change: LocationEndChange | LocationStartChange
      if (edge === 'end') {
        const featureId = feature._id
        const oldEnd = feature.max
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
        const oldStart = feature.min
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
      await changeManager.submit(change)
    }
    // eslint-disable-next-line unicorn/no-useless-undefined
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
          // eslint-disable-next-line unicorn/no-useless-undefined
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
            ;(session as unknown as AbstractSessionModel).queueDialog(
              (doneCallback) => [
                AddChildFeature,
                {
                  session,
                  handleClose: () => {
                    doneCallback()
                    // eslint-disable-next-line unicorn/no-useless-undefined
                    setContextMenuFeature(undefined)
                  },
                  changeManager,
                  sourceFeature: contextMenuFeature,
                  sourceAssemblyId: currentAssemblyId,
                  internetAccount: apolloInternetAccount,
                },
              ],
            )
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
            ;(session as unknown as AbstractSessionModel).queueDialog(
              (doneCallback) => [
                CopyFeature,
                {
                  session,
                  handleClose: () => {
                    doneCallback()
                    // eslint-disable-next-line unicorn/no-useless-undefined
                    setContextMenuFeature(undefined)
                  },
                  changeManager,
                  sourceFeature: contextMenuFeature,
                  sourceAssemblyId: currentAssemblyId,
                },
              ],
            )
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
            ;(session as unknown as AbstractSessionModel).queueDialog(
              (doneCallback) => [
                DeleteFeature,
                {
                  session,
                  handleClose: () => {
                    doneCallback()
                    // eslint-disable-next-line unicorn/no-useless-undefined
                    setContextMenuFeature(undefined)
                  },
                  changeManager,
                  sourceFeature: contextMenuFeature,
                  sourceAssemblyId: currentAssemblyId,
                  selectedFeature,
                  setSelectedFeature,
                },
              ],
            )
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
        // onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        // onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onContextMenu={onContextMenu}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          // cursor:
          //   dragging || (apolloFeatureUnderMouse && overEdge)
          //     ? 'col-resize'
          //     : 'default',
        }}
      />
      <canvas
        ref={codonCanvasRef}
        width={totalWidth}
        height={height * 6}
        style={{ position: 'absolute', left: 0, top: 0 }}
      />
    </div>
  )
}

export default observer(ApolloRendering)
