import { Instance, SnapshotIn, types } from 'mobx-state-tree'

import { CanvasGlyph } from './CanvasGlyph'
import { SceneGraphNode } from './SceneGraphNode'

export const SceneGraphRootNode = SceneGraphNode.named(
  'SceneGraphRootNode',
).props({ children: types.array(CanvasGlyph) })

export type SceneGraphRootNodeI = Instance<typeof SceneGraphRootNode>
export type SceneGraphRootNodeSnapshotIn = SnapshotIn<typeof SceneGraphRootNode>
