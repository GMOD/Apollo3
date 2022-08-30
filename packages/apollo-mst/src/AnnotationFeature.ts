import { findParentThatIs } from '@jbrowse/core/util'
import {
  IAnyModelType,
  Instance,
  SnapshotIn,
  SnapshotOrInstance,
  cast,
  types,
} from 'mobx-state-tree'

export function isAnnotationFeatureModel(
  thing: unknown,
): thing is AnnotationFeatureI {
  return (
    typeof thing === 'object' &&
    thing !== null &&
    'type' in thing &&
    (thing as AnnotationFeatureI).type === 'AnnotationFeatureLocation'
  )
}

export const LateAnnotationFeature = types.late(
  (): IAnyModelType => AnnotationFeature,
)

export const AnnotationFeature = types
  .model('AnnotationFeature', {
    _id: types.identifier,
    /** Reference sequence name */
    refName: types.string,
    /** Feature type */
    type: types.string,
    /** Feature location start coordinate */
    start: types.number,
    /** Feature location end coordinate */
    end: types.number,
    /**
     * If the feature exists in multiple places, e.g. a CDS in a canonical SO
     * gene, this gives the coordinates of the individual starts and ends. The
     * start of the first location and the end of the last location should match
     * the feature's start and end.
     */
    discontinuousLocations: types.maybe(
      types.array(types.model({ start: types.number, end: types.number })),
    ),
    /** The strand on which the feature is located */
    strand: types.maybe(types.union(types.literal(1), types.literal(-1))),
    /** The feature's score */
    score: types.maybe(types.number),
    /**
     * The feature's phase, which is required for certain features, e.g. CDS in a
     * canonical SO gene
     */
    phase: types.maybe(
      types.union(types.literal(0), types.literal(1), types.literal(2)),
    ),
    /** Child features of this feature */
    children: types.maybe(types.map(types.maybe(LateAnnotationFeature))),
    /**
     * Additional attributes of the feature. This could include name, source,
     * note, dbxref, etc.
     */
    attributes: types.map(types.array(types.string)),
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
        min = Math.min(min, child.min)
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
        max = Math.max(max, child.max)
      })
      return max
    },
    get featuresForRow(): typeof self[][] {
      const features = [[self]]
      if (self.children) {
        self.children?.forEach((child: AnnotationFeatureI) => {
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
    setType(type: string) {
      self.type = type
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
    setStrand(strand?: 1 | -1) {
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
      strand?: 1 | -1
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
        const { rowCount } = feature as AnnotationFeatureI
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
          feature.type &&
            ctx.fillText(
              feature.type,
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
      let parent: AnnotationFeatureI | undefined = undefined
      try {
        parent = findParentThatIs(self, isAnnotationFeatureModel)
      } catch (error) {
        // pass
      }
      return parent?._id
    },
  }))

export type AnnotationFeatureI = Instance<typeof AnnotationFeature>
type AnnotationFeatureSnapshotRaw = SnapshotIn<typeof AnnotationFeature>
export interface AnnotationFeatureSnapshot
  extends AnnotationFeatureSnapshotRaw {
  /** Child features of this feature */
  children?: Record<string, AnnotationFeatureSnapshot>
}

export const FeatureMap = types.map(AnnotationFeature)
export const FeaturesForRefName = types.map(FeatureMap)
export type FeaturesForRefNameI = Instance<typeof FeaturesForRefName>
export type FeaturesForRefNameSnapshot = SnapshotIn<typeof FeaturesForRefName>
