import { observer } from 'mobx-react'
import { IAnyStateTreeNode } from 'mobx-state-tree'
import React from 'react'

export const ApolloFeatureDetailsWidget = observer(
  function ApolloFeatureDetails(props: { model: IAnyStateTreeNode }) {
    const { model } = props
    console.log('**** Apollo feature details... ***')
    // rendering code here
    return (
      <div>
        <h1>Hello, {name}!</h1>
        <p>This is a simple React component.</p>
      </div>
    )
  },
)
export default ApolloFeatureDetailsWidget
