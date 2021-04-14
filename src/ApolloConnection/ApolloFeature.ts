import { getParent, IAnyModelType, Instance, types } from 'mobx-state-tree'

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
  })
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
