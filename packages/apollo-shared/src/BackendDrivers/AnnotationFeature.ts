import { findParentThatIs } from '@jbrowse/core/util'
import {
  IAnyType,
  Instance,
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
    get length() {
      return self.end - self.start
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
  }))

export type AnnotationFeatureI = Instance<typeof AnnotationFeature>
export type AnnotationFeatureLocationI = Instance<
  typeof AnnotationFeatureLocation
>

export const FeatureMap = types.map(AnnotationFeatureLocation)
export const FeaturesForRefName = types.map(FeatureMap)
