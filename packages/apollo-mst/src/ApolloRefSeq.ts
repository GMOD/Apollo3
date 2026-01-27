import { doesIntersect2, isContainedWithin } from '@jbrowse/core/util'
import {
  type Instance,
  type SnapshotIn,
  type SnapshotOrInstance,
  types,
} from '@jbrowse/mobx-state-tree'

import {
  type AnnotationFeature,
  AnnotationFeatureModel,
  type AnnotationFeatureSnapshot,
} from './AnnotationFeatureModel'

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
    description: '',
    features: types.map(AnnotationFeatureModel),
    sequence: types.array(Sequence),
  })
  .actions((self) => ({
    addFeature(feature: AnnotationFeatureSnapshot) {
      self.features.put(feature)
    },
    deleteFeature(featureId: string) {
      return self.features.delete(featureId)
    },
    setDescription(description: string) {
      self.description = description
    },
    addSequence(seq: SnapshotOrInstance<typeof Sequence>) {
      if (seq.sequence.length !== seq.stop - seq.start) {
        throw new Error(
          `sequence does not match declared length: ${JSON.stringify(seq)}`,
        )
      }
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
      newSequences.sort((s1, s2) => {
        if (s1.start === s2.start) {
          return s1.stop - s2.stop
        }
        return s1.start - s2.start
      })

      // eslint-disable-next-line unicorn/no-array-reduce
      const consolidatedSequences = newSequences.reduce<SequenceSnapshot[]>(
        (result, current) => {
          const lastRange = result.at(-1)
          if (lastRange === undefined) {
            return [current]
          }
          if (lastRange.stop >= current.start) {
            if (current.stop > lastRange.stop) {
              const overlapLength = lastRange.stop - current.start
              lastRange.stop = current.stop
              lastRange.sequence += current.sequence.slice(overlapLength)
            }
          } else {
            result.push(current)
          }
          return result
        },
        [],
      )
      for (const seq of consolidatedSequences) {
        if (seq.sequence.length !== seq.stop - seq.start) {
          throw new Error(
            'Consolidated sequence does not match declared length',
          )
        }
      }
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
        if (isContainedWithin(start, stop, seqStart, seqStop)) {
          return sequence.slice(start - seqStart, stop - seqStart)
        }
      }
      return ''
    },
    getFeatures(min: number, max: number): AnnotationFeature[] {
      const features: AnnotationFeature[] = []
      for (const [, feature] of self.features) {
        if (doesIntersect2(feature.min, feature.max, min, max)) {
          features.push(feature)
        }
      }
      return features
    },
  }))

// eslint disables because of
// https://mobx-state-tree.js.org/tips/typescript#using-a-mst-type-at-design-time
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ApolloRefSeqI extends Instance<typeof ApolloRefSeq> {}
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ApolloRefSeqSnapshot extends SnapshotIn<typeof ApolloRefSeq> {}
