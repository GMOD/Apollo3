import {
  IAnyModelType,
  Instance,
  SnapshotIn,
  SnapshotOrInstance,
  cast,
  getParent,
  types,
} from 'mobx-state-tree'

const Location = types
  .model('Location', {
    refName: types.string,
    start: types.number,
    end: types.number,
    strand: types.maybe(types.enumeration('Strand', ['+', '-'])),
  })
  .views((self) => ({
    get length() {
      return self.end - self.start
    },
  }))
  .actions((self) => ({
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
  }))

const ChildFeature = types.late((): IAnyModelType => AnnotationFeature)

const AnnotationFeature = types
  .model('AnnotationFeature', {
    id: types.identifier,
    type: types.optional(
      types.literal('AnnotationFeature'),
      'AnnotationFeature',
    ),
    assemblyName: types.string,
    location: Location,
    children: types.maybe(types.map(ChildFeature)),
    name: types.maybe(types.string),
  })
  .actions((self) => ({
    update({
      location,
      children,
    }: {
      location: SnapshotIn<typeof Location>
      children?: SnapshotOrInstance<typeof self.children>
    }) {
      self.location = cast(location)
      if (children) {
        self.children = cast(children)
      }
    },
    addChild(childFeature: SnapshotOrInstance<typeof ChildFeature>) {
      self.children?.set(childFeature.id, childFeature)
    },
  }))
  .views((self) => ({
    parentId() {
      const parent = getParent(self, 2)
      if (parent.type === 'AnnotationFeature') {
        return (parent as Instance<typeof AnnotationFeature>).id
      }
      return undefined
    },
  }))

export default AnnotationFeature

export type AnnotationFeatureI = Instance<typeof AnnotationFeature>
