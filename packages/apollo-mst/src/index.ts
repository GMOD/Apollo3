import {
  Instance,
  SnapshotIn,
  SnapshotOrInstance,
  types,
} from 'mobx-state-tree'

import { AnnotationFeature } from './AnnotationFeature'

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
      const consolidatedSequences = newSequences.reduce((result, current) => {
        if (result.length === 0) {
          return [current]
        }
        const lastRange = result[result.length - 1]
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
        start: seqStart,
        stop: seqStop,
        sequence,
      } of self.sequence) {
        // adjacent to existing sequence - modify
        if (start <= seqStop && stop >= seqStart) {
          return sequence.slice(start - seqStart, stop - seqStart)
        }
      }
      return ''
    },
  }))

export const ApolloAssembly = types
  .model('ApolloAssembly', {
    _id: types.identifier,
    refSeqs: types.map(ApolloRefSeq),
  })
  .views((self) => ({
    getByRefName(refName: string) {
      return Array.from(self.refSeqs.values()).find(
        (val) => val.name === refName,
      )
    },
  }))

export type ApolloRefSeqI = Instance<typeof ApolloRefSeq>
export type ApolloRefSeqSnapshot = SnapshotIn<typeof ApolloRefSeq>
export type ApolloAssemblyI = Instance<typeof ApolloAssembly>
export type ApolloAssemblySnapshot = SnapshotIn<typeof ApolloAssembly>

export * from './AnnotationFeature'
