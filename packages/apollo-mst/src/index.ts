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
      } else {
        let found = false
        for (const [i, { start, stop, sequence }] of self.sequence.entries()) {
          if (seq.stop < stop && seq.start > start) {
            // already there - do nothing
            found = true
          } else if (seq.start < start || seq.stop > stop) {
            // adjacent/overlapping to existing sequence - modify
            const newStart = Math.min(start, seq.start)
            const newStop = Math.max(stop, seq.stop)
            // let newSeq = seq.sequence
            let newSeq = sequence
            if (seq.start < start) {
              // newSeq = newSeq.slice(0, start - seq.start).concat(sequence)
              newSeq = seq.sequence.slice(0, start - seq.start).concat(newSeq)
            }
            if (seq.stop > stop) {
              // newSeq = sequence.concat(newSeq.slice(stop - seq.start))
              newSeq = newSeq.concat(seq.sequence.slice(stop - seq.start))
            }
            self.sequence.splice(i, 1, {
              start: newStart,
              stop: newStop,
              sequence: newSeq,
            })
            found = true
          }
        }
        if (!found) {
          // not adjacent - add new item to array
          self.sequence.push(seq)
        }
      }
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
        if (start < seqStop && stop > seqStart) {
          return sequence.slice(start - seqStart, stop - seqStart)
        }
      }
      throw new Error(
        `No sequence detected for ${start}, ${stop} of region ${self.name}`,
      )
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
