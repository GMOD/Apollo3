import { observer } from 'mobx-react'
import React from 'react'

import { LinearApolloSixFrameDisplay } from '../stateModel'

export const TrackLines = observer(function TrackLines({
  model,
}: {
  model: LinearApolloSixFrameDisplay
}) {
  const { featuresHeight } = model
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: featuresHeight / 2,
        width: '100%',
      }}
    >
      <hr style={{ margin: 0, top: 0, color: 'black' }} />
    </div>
  )
})
