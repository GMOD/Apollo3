import { autorun } from 'mobx'
import { addDisposer, getParent, types } from 'mobx-state-tree'

import SceneGraphNode from './SceneGraphNode'
import { LateAnnotationFeature } from '.'

const CanvasGlyph = SceneGraphNode.named('CanvasGlyph')
  .props({
    feature: types.reference(LateAnnotationFeature),
  })
  .views((self) => ({
    getDisplay() {
      const root = self.sceneGraphRoot
      let parent = getParent(root)
      while (
        !(
          'type' in parent &&
          (parent as { type: string }).type === 'LinearApolloDisplay'
        )
      ) {
        parent = getParent(parent)
      }
      return parent
    },
  }))
  .actions((self) => ({
    render(): void {
      // no-op in base
    },
  }))
  .actions((self) => ({
    afterAttach() {
      // set up an autorun
      addDisposer(
        self,
        autorun(() => {
          self.render()
        }),
      )
    },
  }))

export default CanvasGlyph
