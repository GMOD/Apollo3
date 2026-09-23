import type { AppRootModel } from '@jbrowse/core/util'

import type { ApolloSessionModel } from './session'

export interface ApolloRootModel extends Omit<AppRootModel, 'session'> {
  session: ApolloSessionModel
}
