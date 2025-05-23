import { getSession, intersection2 } from '@jbrowse/core/util'
import {
  type IAnyModelType,
  type IMSTMap,
  type Instance,
  type SnapshotIn,
  type SnapshotOrInstance,
  cast,
  getParentOfType,
  getSnapshot,
  types,
} from 'mobx-state-tree'

import { ApolloAssembly } from '.'

const LateAnnotationFeature = types.late(
  (): IAnyModelType => AnnotationFeatureModel,
)

export interface TranscriptPartLocation {
  min: number
  max: number
}

export interface TranscriptPartNonCoding extends TranscriptPartLocation {
  type: 'fivePrimeUTR' | 'threePrimeUTR' | 'intron' | 'exon'
}

export interface TranscriptPartCoding extends TranscriptPartLocation {
  type: 'CDS'
  phase: 0 | 1 | 2
}

export type TranscriptPart = TranscriptPartCoding | TranscriptPartNonCoding

type TranscriptParts = TranscriptPart[]

export const AnnotationFeatureModel = types
  .model('AnnotationFeatureModel', {
    _id: types.identifier,
    /** Unique ID of the reference sequence on which this feature is located */
    refSeq: types.string,
    /**
     * Type of feature. Can be any string, but is usually an ontology term,
     * e.g. "gene" from the
     * {@link http://sequenceontology.org/browser/current_release/term/SO:0000704 |Sequence Ontology}.
     */
    type: types.string,
    /**
     * Coordinate of the edge of the feature that is closer to the beginning of
     * the reference sequence. This can be thought of as the "start" of features
     * on the positive strand. Uses interbase (0-based half-open) coordinates.
     */
    min: types.number,
    /**
     * Coordinate of the edge of the feature that is closer to the end of the
     * reference sequence. This can be thought of as the "end" of features on
     * the positive strand. Uses interbase (0-based half-open) coordinates.
     */
    max: types.number,
    /**
     * The strand on which the feature is located. `+1` for the positive (a.k.a.
     * plus or forward) and `-1` for the negative (a.k.a minus or reverse)
     * strand.
     */
    strand: types.maybe(types.union(types.literal(1), types.literal(-1))),
    /** Child features of this feature */
    children: types.maybe(types.map(LateAnnotationFeature)),
    /**
     * Additional attributes of the feature. This could include name, source,
     * note, dbxref, etc.
     */
    attributes: types.map(types.array(types.string)),
  })
  .views((self) => ({
    get length() {
      return self.max - self.min
    },
    get featureId() {
      return self.attributes.get('id')
    },
    /**
     * Possibly different from `min` because "The GFF3 format does not enforce a
     * rule in which features must be wholly contained within the location of
     * their parents"
     */
    get minWithChildren() {
      let { min } = self
      const children = self.children as Children
      if (!children) {
        return min
      }
      for (const [, child] of children) {
        min = Math.min(min, child.min)
      }
      return min
    },
    /**
     * Possibly different from `max` because "The GFF3 format does not enforce a
     * rule in which features must be wholly contained within the location of
     * their parents"
     */
    get maxWithChildren() {
      let { max } = self
      const children = self.children as Children
      if (!children) {
        return max
      }
      for (const [, child] of children) {
        max = Math.max(max, child.max)
      }
      return max
    },
    hasDescendant(featureId: string) {
      const children = self.children as Children
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
    get transcriptExonParts(): TranscriptParts {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
      const session = getSession(self) as any
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const { apolloDataStore } = session
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const { featureTypeOntology } = apolloDataStore.ontologyManager
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      if (!featureTypeOntology.isTypeOf(self.type, 'transcript')) {
        throw new Error(
          'Feature is not a transcript or equivalent, cannot calculate exon locations',
        )
      }
      const children = self.children as Children
      if (!children) {
        throw new Error('No exons in transcript')
      }
      const sortedChildren = [...children.values()]
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        .filter((child) => featureTypeOntology.isTypeOf(child.type, 'exon'))
        .sort((a, b) => a.min - b.min)
      let lastMax = self.min
      const parts: TranscriptParts = []
      for (const child of sortedChildren) {
        if (child.min > lastMax) {
          parts.push({
            min: lastMax,
            max: child.min,
            type: 'intron',
          })
        }
        parts.push({
          min: child.min,
          max: child.max,
          type: 'exon',
        })
        lastMax = child.max
      }
      if (lastMax < self.max) {
        parts.push({
          min: lastMax,
          max: self.max,
          type: 'intron',
        })
      }
      if (self.strand === -1) {
        parts.reverse()
      }
      return parts
    },
    get transcriptParts(): TranscriptParts[] {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
      const session = getSession(self) as any
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const { apolloDataStore } = session
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const { featureTypeOntology } = apolloDataStore.ontologyManager
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      if (!featureTypeOntology.isTypeOf(self.type, 'transcript')) {
        throw new Error(
          'Only features of type "transcript" or equivalent can calculate CDS locations',
        )
      }
      const children = self.children as Children
      if (!children) {
        throw new Error('no CDS or exons in transcript')
      }
      const cdsChildren = [...children.values()].filter(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        (child) => featureTypeOntology.isTypeOf(child.type, 'CDS'),
      )
      const transcriptParts: TranscriptParts[] = []
      if (cdsChildren.length === 0) {
        transcriptParts.push(this.transcriptExonParts)
        return transcriptParts
      }
      for (const cds of cdsChildren) {
        const { max: cdsMax, min: cdsMin } = cds
        const parts: TranscriptParts = []
        let hasIntersected = false
        const exonLocations: TranscriptPartLocation[] = []
        for (const [, child] of children) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          if (featureTypeOntology.isTypeOf(child.type, 'exon')) {
            exonLocations.push({ min: child.min, max: child.max })
          }
        }
        exonLocations.sort(({ min: a }, { min: b }) => a - b)
        for (const child of exonLocations) {
          const lastPart = parts.at(-1)
          if (lastPart) {
            parts.push({ min: lastPart.max, max: child.min, type: 'intron' })
          }
          const [start, end] = intersection2(
            cdsMin,
            cdsMax,
            child.min,
            child.max,
          )
          let utrType: 'fivePrimeUTR' | 'threePrimeUTR'
          if (hasIntersected) {
            utrType = self.strand === 1 ? 'threePrimeUTR' : 'fivePrimeUTR'
          } else {
            utrType = self.strand === 1 ? 'fivePrimeUTR' : 'threePrimeUTR'
          }
          if (start !== undefined && end !== undefined) {
            hasIntersected = true
            if (start === child.min && end === child.max) {
              parts.push({ min: start, max: end, phase: 0, type: 'CDS' })
            } else if (start === child.min) {
              parts.push(
                { min: start, max: end, phase: 0, type: 'CDS' },
                { min: end, max: child.max, type: utrType },
              )
            } else if (end === child.max) {
              parts.push(
                { min: child.min, max: start, type: utrType },
                { min: start, max: end, phase: 0, type: 'CDS' },
              )
            } else {
              parts.push(
                { min: child.min, max: start, type: utrType },
                { min: start, max: end, phase: 0, type: 'CDS' },
                {
                  min: end,
                  max: child.max,
                  type:
                    utrType === 'fivePrimeUTR'
                      ? 'threePrimeUTR'
                      : 'fivePrimeUTR',
                },
              )
            }
          } else {
            parts.push({ min: child.min, max: child.max, type: utrType })
          }
        }
        parts.sort(({ min: a }, { min: b }) => a - b)
        if (self.strand === -1) {
          parts.reverse()
        }
        let nextPhase: 0 | 1 | 2 = 0
        const phasedParts = parts.map((loc) => {
          if (loc.type !== 'CDS') {
            return loc
          }
          const phase = nextPhase
          nextPhase = ((3 - ((loc.max - loc.min - phase + 3) % 3)) % 3) as
            | 0
            | 1
            | 2
          return { ...loc, phase }
        })
        transcriptParts.push(phasedParts)
      }
      return transcriptParts
    },
  }))
  .views((self) => ({
    get cdsLocations(): TranscriptPartCoding[][] {
      const { transcriptParts } = self
      return transcriptParts.map((transcript) =>
        transcript.filter((transcriptPart) => transcriptPart.type === 'CDS'),
      )
    },
    get looksLikeGene(): boolean {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
      const session = getSession(self) as any
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const { apolloDataStore } = session
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const { featureTypeOntology } = apolloDataStore.ontologyManager
      if (!featureTypeOntology) {
        return false
      }
      const children = self.children as Children
      if (!children?.size) {
        return false
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const isGene =
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        featureTypeOntology.isTypeOf(self.type, 'gene') ||
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        featureTypeOntology.isTypeOf(self.type, 'pseudogene')
      if (!isGene) {
        return false
      }
      for (const [, child] of children) {
        if (
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          featureTypeOntology.isTypeOf(child.type, 'transcript') ||
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          featureTypeOntology.isTypeOf(child.type, 'pseudogenic_transcript')
        ) {
          const { children: grandChildren } = child
          if (!grandChildren?.size) {
            return false
          }
          return [...grandChildren.values()].some((grandchild) =>
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            featureTypeOntology.isTypeOf(grandchild.type, 'exon'),
          )
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
    setMin(min: number) {
      if (min > self.max) {
        throw new Error(`Min "${min}" is greater than max "${self.max}"`)
      }
      if (self.min !== min) {
        self.min = min
      }
    },
    setMax(max: number) {
      if (max < self.min) {
        throw new Error(`Max "${max}" is less than Min "${self.min}"`)
      }
      if (self.max !== max) {
        self.max = max
      }
    },
    setStrand(strand?: 1 | -1) {
      self.strand = strand
    },
    addChild(childFeature: AnnotationFeatureSnapshot) {
      if (self.children && self.children.size > 0) {
        const existingChildren = getSnapshot<
          Record<string, AnnotationFeatureSnapshot>
        >(self.children)
        self.children.clear()
        for (const [, child] of Object.entries({
          ...existingChildren,
          [childFeature._id]: childFeature,
        }).sort(([, a], [, b]) => a.min - b.min)) {
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
      max,
      min,
      refSeq,
      strand,
    }: {
      refSeq: string
      min: number
      max: number
      strand?: 1 | -1
      children?: SnapshotOrInstance<typeof self.children>
    }) {
      self.setRefSeq(refSeq)
      self.setMin(min)
      self.setMax(max)
      self.setStrand(strand)
      if (children) {
        self.children = cast(children)
      }
    },
  }))
  // This views block has to be last to avoid:
  // "'parent' is referenced directly or indirectly in its own type annotation."
  .views((self) => ({
    get parent(): AnnotationFeature | undefined {
      let parent: AnnotationFeature | undefined
      try {
        parent = getParentOfType(self, AnnotationFeatureModel)
      } catch {
        // pass
      }
      return parent
    },
    get topLevelFeature(): AnnotationFeature {
      let feature = self
      let parent
      do {
        try {
          parent = getParentOfType(feature, AnnotationFeatureModel)
          feature = parent
        } catch {
          parent = undefined
        }
      } while (parent)
      return feature as AnnotationFeature
    },
    get assemblyId(): string {
      return getParentOfType(self, ApolloAssembly)._id
    },
  }))

export type Children = IMSTMap<typeof AnnotationFeatureModel> | undefined

// eslint disables because of
// https://mobx-state-tree.js.org/tips/typescript#using-a-mst-type-at-design-time
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface AnnotationFeatureRaw
  extends Instance<typeof AnnotationFeatureModel> {}
// This type isn't exactly right, since "children" is actually an IMSTMap and
// not a Map, but it's better than typing it as any.
export interface AnnotationFeature
  extends Omit<AnnotationFeatureRaw, 'children'> {
  children?: Map<string | number, AnnotationFeature>
}
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface AnnotationFeatureSnapshotRaw
  extends SnapshotIn<typeof AnnotationFeatureModel> {}
export interface AnnotationFeatureSnapshot
  extends AnnotationFeatureSnapshotRaw {
  /** Child features of this feature */
  children?: Record<string, AnnotationFeatureSnapshot>
}
