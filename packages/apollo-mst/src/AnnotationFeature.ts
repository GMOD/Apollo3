import {
  IAnyModelType,
  Instance,
  SnapshotIn,
  SnapshotOrInstance,
  cast,
  getParentOfType,
  getSnapshot,
  types,
} from 'mobx-state-tree'

import { ApolloAssembly } from '.'

export const LateAnnotationFeature = types.late(
  (): IAnyModelType => AnnotationFeature,
)

const Phase = types.maybe(
  types.union(types.literal(0), types.literal(1), types.literal(2)),
)
export const AnnotationFeature = types
  .model('AnnotationFeature', {
    _id: types.identifier,
    gffId: types.maybe(types.string), // ID from attributes if exists, otherwise gffId = _id
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
      types.array(
        types.model({ start: types.number, end: types.number, phase: Phase }),
      ),
    ),
    /** The strand on which the feature is located */
    strand: types.maybe(types.union(types.literal(1), types.literal(-1))),
    /** The feature's score */
    score: types.maybe(types.number),
    /**
     * The feature's phase, which is required for certain features, e.g. CDS in a
     * canonical SO gene
     */
    phase: Phase,
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
      for (const [, child] of self.children ?? []) {
        min = Math.min(min, child.min)
      }
      return min
    },
    /**
     * Possibly different from `end` because "The GFF3 format does not enforce a
     * rule in which features must be wholly contained within the location of
     * their parents"
     */
    get max() {
      let max = self.end
      for (const [, child] of self.children ?? []) {
        max = Math.max(max, child.max)
      }
      return max
    },
    hasDescendant(featureId: string) {
      const { children } = self
      if (!children) {
        return false
      }
      for (const [id, child] of children) {
        if (id === featureId) {
          return true
        }
        if (child.hasDescendant(featureId)) {
          return true
        }
      }
      return false
    },
  }))
  .actions((self) => ({
    setAttributes(attributes: Map<string, string[]>) {
      self.attributes.clear()
      for (const [key, value] of attributes.entries()) {
        self.attributes.set(key, value)
      }
    },
    setAttribute(key: string, value: string[]) {
      self.attributes.merge({ [key]: value })
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
    setCDSDiscontinuousLocationStart(start: number, index: number) {
      const dl = self.discontinuousLocations
      if (dl && dl.length > 0 && dl[index].start !== start) {
        dl[index].start = start
        if (index === 0) {
          self.start = start
        }
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
    setCDSDiscontinuousLocationEnd(end: number, index: number) {
      const dl = self.discontinuousLocations
      if (dl && dl.length > 0 && dl[index].end !== end) {
        dl[index].end = end
        if (index === dl.length - 1) {
          self.end = end
        }
      }
    },
    setStrand(strand?: 1 | -1) {
      self.strand = strand
    },
    addChild(childFeature: AnnotationFeatureSnapshot) {
      if (self.children && self.children.size > 0) {
        const existingChildren = getSnapshot(self.children) ?? {}
        self.children.clear()
        for (const [, child] of Object.entries({
          ...existingChildren,
          [childFeature._id]: childFeature,
        }).sort(([, a], [, b]) => a.start - b.start)) {
          self.children.put(child)
        }
      } else {
        self.children = cast({})
        self.children?.put(childFeature)
      }
    },
    deleteChild(childFeatureId: string) {
      self.children?.delete(childFeatureId)
    },
  }))
  .actions((self) => ({
    update({
      children,
      end,
      refSeq,
      start,
      strand,
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
  // This views block has to be last to avoid:
  // "'parent' is referenced directly or indirectly in its own type annotation."
  .views((self) => ({
    get parent() {
      let parent: AnnotationFeatureI | undefined
      try {
        parent = getParentOfType(self, AnnotationFeature)
      } catch {
        // pass
      }
      return parent
    },
    get topLevelFeature() {
      let feature = self
      let parent
      do {
        try {
          parent = getParentOfType(feature, AnnotationFeature)
          feature = parent
        } catch {
          parent = undefined
        }
      } while (parent)
      return feature
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
