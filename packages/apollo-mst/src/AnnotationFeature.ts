import {
  IAnyModelType,
  Instance,
  SnapshotIn,
  SnapshotOrInstance,
  cast,
  getParentOfType,
  types,
} from 'mobx-state-tree'

import { ApolloAssembly } from '.'

export const LateAnnotationFeature = types.late(
  (): IAnyModelType => AnnotationFeature,
)

export const AnnotationFeature = types
  .model('AnnotationFeature', {
    _id: types.identifier,
    /** Reference sequence name */
    refSeq: types.string,
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
    get featureId() {
      return self.attributes.get('id')
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
  }))
  .actions((self) => ({
    setAttributes(attributes: Map<string, string[]>) {
      self.attributes.clear()
      Array.from(attributes.entries()).forEach(([key, value]) =>
        self.attributes.set(key, value),
      )
    },
    setType(type: string) {
      self.type = type
    },
    setRefSeq(refSeq: string) {
      self.refSeq = refSeq
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
    addChild(childFeature: AnnotationFeatureSnapshot) {
      if (!self.children) {
        self.children = cast({})
      }
      self.children?.put(childFeature)
    },
    deleteChild(childFeatureId: string) {
      self.children?.delete(childFeatureId)
    },
  }))
  .actions((self) => ({
    update({
      refSeq,
      start,
      end,
      strand,
      children,
    }: {
      refSeq: string
      start: number
      end: number
      strand?: 1 | -1
      children?: SnapshotOrInstance<typeof LateAnnotationFeature>
    }) {
      self.setRefSeq(refSeq)
      self.setStart(start)
      self.setEnd(end)
      self.setStrand(strand)
      if (children) {
        self.children = cast(children)
      }
    },
  }))
  // rendering code below here
  .views((self) => ({
    get featuresForRow(): typeof self[][] {
      const features = [[self]]
      if (self.children) {
        self.children.forEach((child) => {
          features.push(...child.featuresForRow)
        })
      }
      return features
    },
    get rowCount() {
      return this.featuresForRow.length
    },
  }))
  .views((self) => ({
    draw(
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      bpPerPx: number,
      rowHeight: number,
      reversed?: boolean,
    ) {
      for (let i = 0; i < self.rowCount; i++) {
        this.drawRow(i, ctx, x, y + i * rowHeight, bpPerPx, rowHeight, reversed)
      }
    },
    drawRow(
      rowNumber: number,
      ctx: CanvasRenderingContext2D,
      xOffset: number,
      yOffset: number,
      bpPerPx: number,
      rowHeight: number,
      reversed?: boolean,
    ) {
      const features = self.featuresForRow[rowNumber]

      features.forEach((feature) => {
        const width = feature.end - feature.start
        const widthPx = width / bpPerPx
        const startBp = reversed
          ? self.end - feature.end
          : feature.start - self.start
        const startPx = startBp / bpPerPx
        const { rowCount } = feature as typeof self
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
  }))
  // This views block has to be last to avoid:
  // "'parent' is referenced directly or indirectly in its own type annotation."
  .views((self) => ({
    get parent() {
      let parent: AnnotationFeatureI | undefined = undefined
      try {
        parent = getParentOfType(self, AnnotationFeature)
      } catch (error) {
        // pass
      }
      return parent
    },
    get assemblyId(): string {
      return getParentOfType(self, ApolloAssembly)._id
    },
  }))

export type AnnotationFeatureI = Instance<typeof AnnotationFeature>
type AnnotationFeatureSnapshotRaw = SnapshotIn<typeof AnnotationFeature>
export interface AnnotationFeatureSnapshot
  extends AnnotationFeatureSnapshotRaw {
  /** Child features of this feature */
  children?: Record<string, AnnotationFeatureSnapshot>
}
