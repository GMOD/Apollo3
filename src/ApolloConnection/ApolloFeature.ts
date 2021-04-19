import {
  getParent,
  IAnyModelType,
  Instance,
  SnapshotIn,
  SnapshotOrInstance,
  types,
  cast,
} from 'mobx-state-tree'

const Location = types
  .model({
    start: types.number,
    end: types.number,
    strand: types.maybe(types.enumeration('Strand', ['+', '-'])),
  })
  .views(self => ({
    get length() {
      return self.end - self.start
    },
  }))
  .actions(self => ({
    setStart(start: number) {
      if (self.start !== start) {
        self.start = start
      }
    },
  }))

const Feature = types
  .model({
    id: types.identifier,
    type: types.optional(types.literal('ApolloFeature'), 'ApolloFeature'),
    location: Location,
    children: types.maybe(types.map(types.late((): IAnyModelType => Feature))),
    name: types.maybe(types.string),
    refName: types.string,
    featureType: types.string,
    dateLastModified: types.maybe(types.number),
  })
  .actions(self => ({
    update({
      location,
      children,
    }: {
      location: SnapshotIn<typeof Location>
      children?: SnapshotOrInstance<typeof self.children>
    }) {
      console.log({ location, children })
      self.location = cast(location)
      if (children) {
        self.children = cast(children)
      }
    },
  }))
  .views(self => ({
    parentId() {
      const parent = getParent(self, 2)
      if (parent.type === 'ApolloFeature') {
        return (parent as Instance<typeof Feature>).id
      }
      return undefined
    },
  }))

export default Feature
