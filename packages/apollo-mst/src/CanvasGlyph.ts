import { getContainingDisplay } from '@jbrowse/core/util'
import { autorun } from 'mobx'
import { Instance, SnapshotIn, addDisposer, types } from 'mobx-state-tree'

import { AnnotationFeature } from './AnnotationFeature'
import { SceneGraphNode } from './SceneGraphNode'

export const CanvasGlyph = SceneGraphNode.named('CanvasGlyph')
  .props({
    feature: types.reference(AnnotationFeature),
  })
  .views((self) => ({
    getDisplay() {
      return getContainingDisplay(self)
    },
    get rowCount() {
      return 1
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

export type CanvasGlyphI = Instance<typeof CanvasGlyph>
export type CanvasGlyphSnapshotIn = SnapshotIn<typeof CanvasGlyph>
