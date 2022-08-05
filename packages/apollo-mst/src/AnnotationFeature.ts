import { findParentThatIs } from '@jbrowse/core/util'
import {
  IAnyType,
  Instance,
  SnapshotIn,
  SnapshotOrInstance,
  cast,
  types,
} from 'mobx-state-tree'

export function isAnnotationFeatureLocationModel(
  thing: unknown,
): thing is AnnotationFeatureLocationI {
  return (
    typeof thing === 'object' &&
    thing !== null &&
    'type' in thing &&
    (thing as AnnotationFeatureLocationI).type === 'AnnotationFeatureLocation'
  )
}

export const LateAnnotationFeature = types.late(
  (): IAnyType => AnnotationFeature,
)

export const AnnotationFeatureLocation = types
  .model('AnnotationFeatureLocation', {
    id: types.identifier,
    type: types.optional(
      types.literal('AnnotationFeatureLocation'),
      'AnnotationFeatureLocation',
    ),
    assemblyName: types.string,
    refName: types.string,
    start: types.number,
    end: types.number,
    strand: types.maybe(types.enumeration('Strand', ['+', '-'])),
    children: types.maybe(types.map(LateAnnotationFeature)),
    name: types.maybe(types.string),
    featureType: types.maybe(types.string),
  })
  .views((self) => ({
    get length() {
      return self.end - self.start
    },
    /**
     * Possibly different from `start` because "The GFF3 format does not enforce
     * a rule in which features must be wholly contained within the location of
     * their parents"
     */
    get min() {
      let min = self.start
      self.children?.forEach((child: AnnotationFeatureI) => {
        child.locations.forEach((childLocation) => {
          min = Math.min(min, childLocation.min)
        })
      })
      return min
    },
    /**
     * Possibly different from `end` because "The GFF3 format does not enforce a
     * rule in which features must be wholly contained within the location of
     * their parents"
     */
    get max() {
      let max = self.end
      self.children?.forEach((child: AnnotationFeatureI) => {
        child.locations.forEach((childLocation) => {
          max = Math.max(max, childLocation.max)
        })
      })
      return max
    },
    get featuresForRow() {
      const features = [[self]]
      if (self.children) {
        self.children?.forEach((child) => {
          features.push(...child.featuresForRow)
        })
      }
      return features
    },
    // get featuresForRow() {
    //   const features = [[self]]
    //   if (self.children) {
    //     const row: AnnotationFeatureLocationI[] = []
    //     self.children?.forEach((child) => {
    //       const f = child.featuresForRow
    //       if (f.length > 1) {
    //         features.push(row)
    //         row.length = 0
    //         features.push(...f)
    //       } else if (
    //         row.find((rowFeature) =>
    //           f[0].find(
    //             (childRowFeature: AnnotationFeatureLocationI) =>
    //               rowFeature.start > childRowFeature.end &&
    //               childRowFeature.start < rowFeature.end,
    //           ),
    //         )
    //       ) {
    //         features.push(row)
    //         row.length = 0
    //         row.push(...f[0])
    //       } else {
    //         row.push(...f[0])
    //       }
    //     })
    //     features.push(row)
    //   }
    //   return features
    // },
    get rowCount() {
      return this.featuresForRow.length
    },
  }))
  .actions((self) => ({
    setFeatureType(featureType: string) {
      self.featureType = featureType
    },
    setRefName(refName: string) {
      self.refName = refName
    },
    setStart(start: number) {
      if (start > self.end) {
        throw new Error(`Start "${start}" is greater than end "${self.end}"`)
      }
      if (self.start !== start) {
        self.start = start
      }
    },
    setEnd(end: number) {
      if (end < self.start) {
        throw new Error(`End "${end}" is less than start "${self.start}"`)
      }
      if (self.end !== end) {
        self.end = end
      }
    },
    setStrand(strand?: '+' | '-') {
      self.strand = strand
    },
  }))
  .actions((self) => ({
    update({
      refName,
      start,
      end,
      strand,
      children,
    }: {
      refName: string
      start: number
      end: number
      strand?: '+' | '-'
      children?: SnapshotOrInstance<typeof LateAnnotationFeature>
    }) {
      self.setRefName(refName)
      self.setStart(start)
      self.setEnd(end)
      self.setStrand(strand)
      if (children) {
        self.children = cast(children)
      }
    },
    addChild(childFeature: SnapshotOrInstance<typeof LateAnnotationFeature>) {
      self.children?.set(childFeature.id, childFeature)
    },
    setFeatureType(featureType: string) {
      self.featureType = featureType
    },
    draw(
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      bpPerPx: number,
      rowHeight: number,
    ) {
      for (let i = 0; i < self.rowCount; i++) {
        this.drawRow(i, ctx, x, y + i * rowHeight, bpPerPx, rowHeight)
      }
    },
    drawRow(
      rowNumber: number,
      ctx: CanvasRenderingContext2D,
      xOffset: number,
      yOffset: number,
      bpPerPx: number,
      rowHeight: number,
    ) {
      const features = self.featuresForRow[rowNumber]

      features.forEach((feature) => {
        const width = feature.end - feature.start
        const startPx = (feature.start - self.start) / bpPerPx
        const widthPx = width / bpPerPx
        const { rowCount } = feature as AnnotationFeatureLocationI
        if (rowCount > 1) {
          const featureHeight = rowCount * rowHeight
          ctx.fillStyle = 'rgba(255,0,0,0.25)'
          ctx.fillRect(xOffset + startPx, yOffset, widthPx, featureHeight)
        }
        ctx.fillStyle = 'black'
        ctx.fillRect(xOffset + startPx, yOffset, widthPx, rowHeight)
        if (widthPx > 2) {
          ctx.clearRect(
            xOffset + startPx + 1,
            yOffset + 1,
            widthPx - 2,
            rowHeight - 2,
          )
          ctx.fillStyle = 'rgba(255,255,255,0.75)'
          ctx.fillRect(
            xOffset + startPx + 1,
            yOffset + 1,
            widthPx - 2,
            rowHeight - 2,
          )
          ctx.fillStyle = 'black'
          feature.featureType &&
            ctx.fillText(
              feature.featureType,
              xOffset + startPx + 1,
              yOffset + 11,
              widthPx - 2,
            )
        }
      })
      if (features.length > 1) {
        let [{ start, end }] = features
        features.forEach((feature) => {
          start = Math.min(start, feature.start)
          end = Math.max(end, feature.end)
        })
        const width = end - start
        const startPx = (start - self.start) / bpPerPx
        const widthPx = width / bpPerPx
        ctx.fillStyle = 'rgba(0,255,255,0.2)'
        ctx.fillRect(
          xOffset + startPx + 1,
          yOffset + 1,
          widthPx - 2,
          rowHeight - 2,
        )
      }
    },
    getFeatureFromLayout(
      x: number,
      y: number,
      bpPerPx: number,
      rowHeight: number,
    ) {
      const bp = bpPerPx * x + self.start
      const row = Math.floor(y / rowHeight)
      const layoutRow = self.featuresForRow[row]
      return layoutRow.find((f) => bp >= f.start && bp <= f.end)
    },
    // drawRow(
    //   rowNumber: number,
    //   rowHeight: number,
    //   bpPerPx: number,
    //   xOffset: number,
    //   yOffset: number,
    //   ctx: CanvasRenderingContext2D,
    // ) {
    //   const feature = self.featuresForRow[rowNumber]
    //   if (self.rowCount === 1) {
    //     const width = feature.length
    //     const startPx = 0
    //     const widthPx = width / bpPerPx
    //     ctx.fillStyle = 'black'
    //     ctx.fillRect(xOffset + startPx, yOffset, widthPx, rowHeight)
    //     if (widthPx > 2) {
    //       ctx.clearRect(
    //         xOffset + startPx + 1,
    //         yOffset + 1,
    //         widthPx - 2,
    //         rowHeight - 2,
    //       )
    //       ctx.fillStyle = 'rgba(255,255,255,0.75)'
    //       ctx.fillRect(
    //         xOffset + startPx + 1,
    //         yOffset + 1,
    //         widthPx - 2,
    //         rowHeight - 2,
    //       )
    //     }
    //     return
    //   }
    //   if (!feature.children) {
    //     throw new Error('no child feature found')
    //   }
    //   const exons = Array.from(feature.children.values())
    //     .flat()
    //     .filter((f: AnnotationFeatureLocationI) => f.featureType === 'exon')
    //     .sort((f1, f2) => {
    //       const { start: start1 } = f1
    //       const { start: start2 } = f2
    //       return start1 - start2
    //     }) as AnnotationFeatureLocationI[]
    //   const introns = exons
    //     .map((exon, idx) => {
    //       if (idx === 0) {
    //         return undefined
    //       }
    //       return [exons[idx - 1].end, exon.start]
    //     })
    //     .filter(Boolean) as [number, number][]
    //   const cdss = Array.from(feature.children.values())
    //     .flat()
    //     .filter((f) => f.featureType === 'CDS') as AnnotationFeatureLocationI[]
    //   const others = Array.from(feature.children.values())
    //     .flat()
    //     .filter(
    //       (f) => !['exon', 'CDS'].includes(f.featureType),
    //     ) as AnnotationFeatureLocationI[]
    //   introns.forEach((intron) => {
    //     const [intronStart, intronEnd] = intron
    //     const start = intronStart - self.start
    //     const width = intronEnd - intronStart
    //     const startPx = start / bpPerPx
    //     const widthPx = width / bpPerPx
    //     ctx.beginPath()
    //     ctx.moveTo(xOffset + startPx, yOffset + rowHeight / 2)
    //     ctx.lineTo(xOffset + startPx + widthPx / 2, yOffset)
    //     ctx.lineTo(xOffset + startPx + widthPx, yOffset + rowHeight / 2)
    //     ctx.lineWidth = 1
    //     ctx.stroke()
    //   })
    //   exons.forEach((exon) => {
    //     const start = exon.start - self.start
    //     const width = exon.length
    //     const startPx = start / bpPerPx
    //     const widthPx = width / bpPerPx
    //     const exonHeight = rowHeight / 2
    //     const exonOffset = rowHeight / 4
    //     ctx.fillStyle = 'black'
    //     ctx.fillRect(
    //       xOffset + startPx,
    //       yOffset + exonOffset,
    //       widthPx,
    //       exonHeight,
    //     )
    //     if (widthPx > 2) {
    //       ctx.clearRect(
    //         xOffset + startPx + 1,
    //         yOffset + exonOffset + 1,
    //         widthPx - 2,
    //         exonHeight - 2,
    //       )
    //       ctx.fillStyle = 'rgba(64,64,256,0.3)'
    //       ctx.fillRect(
    //         xOffset + startPx + 1,
    //         yOffset + exonOffset + 1,
    //         widthPx - 2,
    //         exonHeight - 2,
    //       )
    //     }
    //   })
    //   cdss.forEach((cds) => {
    //     const start = cds.start - self.start
    //     const width = cds.length
    //     const startPx = start / bpPerPx
    //     const widthPx = width / bpPerPx
    //     ctx.fillStyle = 'black'
    //     ctx.fillRect(xOffset + startPx, yOffset, widthPx, rowHeight)
    //     if (widthPx > 2) {
    //       ctx.clearRect(
    //         xOffset + startPx + 1,
    //         yOffset + 1,
    //         widthPx - 2,
    //         rowHeight - 2,
    //       )
    //       ctx.fillStyle = 'rgba(256,256,64,0.3)'
    //       ctx.fillRect(
    //         xOffset + startPx + 1,
    //         yOffset + 1,
    //         widthPx - 2,
    //         rowHeight - 2,
    //       )
    //     }
    //   })
    //   others.forEach((other) => {
    //     const start = other.start - self.start
    //     const width = other.length
    //     const startPx = start / bpPerPx
    //     const widthPx = width / bpPerPx
    //     ctx.fillStyle = 'black'
    //     ctx.fillRect(xOffset + startPx, yOffset, widthPx, rowHeight)
    //     if (widthPx > 2) {
    //       ctx.clearRect(
    //         xOffset + startPx + 1,
    //         yOffset + 1,
    //         widthPx - 2,
    //         rowHeight - 2,
    //       )
    //       ctx.fillStyle = 'rgba(255,255,255,0.75)'
    //       ctx.fillRect(
    //         xOffset + startPx + 1,
    //         yOffset + 1,
    //         widthPx - 2,
    //         rowHeight - 2,
    //       )
    //     }
    //   })
    // },
  }))
  .views((self) => ({
    parentId() {
      let parent: AnnotationFeatureLocationI | undefined = undefined
      try {
        parent = findParentThatIs(self, isAnnotationFeatureLocationModel)
      } catch (error) {
        // pass
      }
      return parent?.id
    },
  }))

export const AnnotationFeature = types
  .model('AnnotationFeature', {
    id: types.identifier,
    type: types.optional(
      types.literal('AnnotationFeature'),
      'AnnotationFeature',
    ),
    locations: types.map(AnnotationFeatureLocation),
  })
  .views((self) => ({
    get min(): number {
      let min: number | undefined = undefined
      self.locations.forEach((location) => {
        min = min === undefined ? location.min : Math.min(min, location.min)
      })
      if (min === undefined) {
        throw new Error(
          `AnnotationFeature does not have any locations: "${self.id}"`,
        )
      }
      return min
    },
    get max(): number {
      let max: number | undefined = undefined
      self.locations.forEach((location) => {
        max = max === undefined ? location.max : Math.max(max, location.max)
      })
      if (max === undefined) {
        throw new Error(
          `AnnotationFeature does not have any locations: "${self.id}"`,
        )
      }
      return max
    },
    get featuresForRow() {
      const features: AnnotationFeatureLocationI[][] = []
      self.locations.forEach((location) => {
        location.featuresForRow.forEach((row, idx) => {
          if (idx > features.length - 1) {
            features[idx] = []
          }
          features[idx].push(...(row as AnnotationFeatureLocationI[]))
        })
      })
      return features
    },
  }))

export type AnnotationFeatureI = Instance<typeof AnnotationFeature>
export type AnnotationFeatureSnapshot = SnapshotIn<typeof AnnotationFeature>
export type AnnotationFeatureLocationI = Instance<
  typeof AnnotationFeatureLocation
>
export type AnnotationFeatureLocationSnapshot = SnapshotIn<
  typeof AnnotationFeatureLocation
>

export const FeatureMap = types.map(AnnotationFeatureLocation)
export const FeaturesForRefName = types.map(FeatureMap)
export type FeaturesForRefNameI = Instance<typeof FeaturesForRefName>
export type FeaturesForRefNameSnapshot = SnapshotIn<typeof FeaturesForRefName>
