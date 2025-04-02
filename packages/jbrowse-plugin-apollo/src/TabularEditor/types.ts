import { LinearApolloDisplay } from '../LinearApolloDisplay/stateModel'
import { LinearApolloSixFrameDisplay } from '../LinearApolloSixFrameDisplay/stateModel'

export type DisplayStateModel =
  | LinearApolloDisplay
  | LinearApolloSixFrameDisplay
