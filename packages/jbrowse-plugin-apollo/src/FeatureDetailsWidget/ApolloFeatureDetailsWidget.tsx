import { observer } from 'mobx-react'
import { IAnyStateTreeNode } from 'mobx-state-tree'
import React from 'react'

export const ApolloFeatureDetailsWidget = observer(
  function ApolloFeatureDetails(props: { model: IAnyStateTreeNode }) {
    const { model } = props
    console.log('**** Apollo feature details... ***')
    return (
      <div>
        <h1>Hello</h1>
      </div>
    )
  },
)
export default ApolloFeatureDetailsWidget
