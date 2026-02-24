import type { LinearApolloDisplay } from '../LinearApolloDisplay/stateModel'
import type { LinearApolloSixFrameDisplay } from '../LinearApolloSixFrameDisplay/stateModel'

export type DisplayStateModel =
  | LinearApolloDisplay
  | LinearApolloSixFrameDisplay
