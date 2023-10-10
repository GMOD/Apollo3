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

    _reverseComplement(dna: string): string {
      const COMPLEMENTS: Record<string, string> = {
        A: 'T',
        C: 'G',
        G: 'C',
        T: 'A',
        N: 'N',
      }

      const revComp = Array.from({ length: dna.length })
      for (let i = 0; i < dna.length; i++) {
        const nt: string = dna[i]
        const rc: string = COMPLEMENTS[nt]
        if (rc === undefined) {
          throw new TypeError(`Cannot complement nucleotide: "${nt}"`)
        }
        revComp[i] = rc
      }
      return revComp.reverse().join('')
    },

    _getCodingSequence(refSeq: any, cdna: string[]): void {
      if (self.type === 'CDS') {
        let seq: string
        if (
          self.discontinuousLocations === undefined ||
          self.discontinuousLocations.length === 0
        ) {
          // Remove -1 once off-by-one error is fixed
          seq = refSeq.getSequence(self.start - 1, self.end).toUpperCase()
        } else {
          for (const x of self.discontinuousLocations) {
            seq = seq + refSeq.getSequence(x.start - 1, x.end).toUpperCase()
          }
        }
        if (self.strand === 1) {
          //
        } else if (self.strand === -1) {
          seq = this._reverseComplement(seq)
        } else {
          throw new Error(`Unexpected strand ${self.strand}`)
        }
        cdna.push(seq)
      }
      if (self.children) {
        for (const [, child] of self.children) {
          child._getCodingSequence(refSeq, cdna)
        }
      }
    },
    getCodingSequence(refSeq: any): string[] {
      const cdna: string[] = []
      this._getCodingSequence(refSeq, cdna)
      return cdna
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
