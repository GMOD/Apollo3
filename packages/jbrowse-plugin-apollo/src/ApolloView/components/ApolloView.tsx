import { observer } from 'mobx-react'
import { getEnv } from 'mobx-state-tree'
import React from 'react'

import { ApolloViewModel } from '../stateModel'

export const ApolloView = observer(({ model }: { model: ApolloViewModel }) => {
  const { pluginManager } = getEnv(model)
  const { linearGenomeView } = model
  const { ReactComponent } = pluginManager.getViewType(linearGenomeView.type)

  return <ReactComponent key={linearGenomeView.id} model={linearGenomeView} />
})
