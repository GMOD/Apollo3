import {
  Instance,
  SnapshotIn,
  SnapshotOrInstance,
  types,
} from 'mobx-state-tree'

import {
  AnnotationFeature,
  AnnotationFeatureSnapshot,
} from './AnnotationFeature'

export const Sequence = types.model({
  start: types.number,
  stop: types.number,
  sequence: types.string,
})

interface SequenceSnapshot {
  start: number
  stop: number
  sequence: string
}

export const ApolloRefSeq = types
  .model('ApolloRefSeq', {
    _id: types.identifier,
    name: types.string,
    features: types.map(AnnotationFeature),
    sequence: types.array(Sequence),
  })
  .actions((self) => ({
    addFeature(feature: AnnotationFeatureSnapshot) {
      self.features.put(feature)
    },
    deleteFeature(featureId: string) {
      return self.features.delete(featureId)
    },
    addSequence(seq: SnapshotOrInstance<typeof Sequence>) {
      if (self.sequence.length === 0) {
        self.sequence.push(seq)
        return
      }
      const newSequences: SequenceSnapshot[] = self.sequence.map((s) => ({
        start: s.start,
        stop: s.stop,
        sequence: s.sequence,
      }))
      newSequences.push({
        start: seq.start,
        stop: seq.stop,
        sequence: seq.sequence,
      })
      newSequences.sort((s1, s2) => s1.start - s2.start)
      // eslint-disable-next-line unicorn/no-array-reduce
      const consolidatedSequences = newSequences.reduce((result, current) => {
        const lastRange = result.at(-1)
        if (lastRange === undefined) {
          return [current]
        }
        if (lastRange.stop >= current.start) {
          if (current.stop > lastRange.stop) {
            lastRange.stop = current.stop
            lastRange.sequence += current.sequence.slice(
              current.stop - lastRange.stop,
            )
          }
        } else {
          result.push(current)
        }
        return result
      }, [] as SequenceSnapshot[])
      if (
        self.sequence.length === consolidatedSequences.length &&
        self.sequence.every(
          (s, idx) =>
            s.start === consolidatedSequences[idx].start &&
            s.stop === consolidatedSequences[idx].stop,
        )
      ) {
        // sequences was unchanged
        return
      }
      self.sequence.clear()
      self.sequence.push(...consolidatedSequences)
    },
  }))
  .views((self) => ({
    getSequence(start: number, stop: number): string {
      for (const {
        sequence,
        start: seqStart,
        stop: seqStop,
      } of self.sequence) {
        // adjacent to existing sequence - modify
        if (start <= seqStop && stop >= seqStart) {
          return sequence.slice(start - seqStart, stop - seqStart)
        }
      }
      return ''
    },
    _reverseComplement(dna: string): string {
      const COMPLEMENTS: Record<string, string> = {
        A: 'T',
        C: 'G',
        G: 'C',
        T: 'A',
        N: 'N',
      }
      const revComp: string[] = []
      for (const nt of dna) {
        const rc: string = COMPLEMENTS[nt.toUpperCase()]
        if (rc === undefined) {
          throw new TypeError(`Cannot complement nucleotide: "${nt}"`)
        }
        if (nt === nt.toLowerCase()) {
          revComp.push(rc.toLowerCase())
        } else {
          revComp.push(rc)
        }
      }
      return revComp.reverse().join('')
    },
    _getCodingSequence(jsonFeature: string, cdna: string[]): void {
      const feature = JSON.parse(jsonFeature)
      if (feature.type === 'CDS') {
        let seq = ''
        if (
          feature.discontinuousLocations === undefined ||
          feature.discontinuousLocations.length === 0
        ) {
          // Remove -1 once off-by-one error is fixed
          seq = this.getSequence(feature.start - 1, feature.end)
        } else {
          for (const x of feature.discontinuousLocations) {
            seq = seq + this.getSequence(x.start - 1, x.end)
          }
        }
        if (feature.strand === 1) {
          //
        } else if (feature.strand === -1) {
          seq = this._reverseComplement(seq)
        } else {
          throw new Error(`Unexpected strand ${feature.strand}`)
        }
        cdna.push(seq)
      }
      if (feature.children) {
        for (const key in feature.children) {
          const child = JSON.stringify(feature.children[key])
          this._getCodingSequence(child, cdna)
        }
      }
    },
    getCodingSequence(jsonFeature: string): string[] {
      const cdna: string[] = []
      this._getCodingSequence(jsonFeature, cdna)
      return cdna
    },
  }))

export type ApolloRefSeqI = Instance<typeof ApolloRefSeq>
export type ApolloRefSeqSnapshot = SnapshotIn<typeof ApolloRefSeq>
