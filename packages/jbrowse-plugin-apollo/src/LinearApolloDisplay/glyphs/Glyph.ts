import type { Glyph as BaseGlyph } from '@apollo-annotation/common/client'

import type { LinearApolloDisplay } from '../stateModel'

export type {
  Layout,
  LayoutRow,
  OverlayType,
} from '@apollo-annotation/common/client'

export type Glyph = BaseGlyph<LinearApolloDisplay>
