import { observer } from 'mobx-react'
import React from 'react'

import { LinearApolloSixFrameDisplay } from '../stateModel'

export const TrackLines = observer(function TrackLines({
  model,
  hrStyle = { margin: 0, top: 0, color: 'black' },
  idx = 0,
}: {
  model: LinearApolloSixFrameDisplay
  hrStyle?: React.CSSProperties
  idx: number
}) {
  const { apolloRowHeight, highestRow, showFeatureLabels } = model
  const featureLabelSpacer = showFeatureLabels ? 2 : 1

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top:
          (apolloRowHeight * featureLabelSpacer * (highestRow + 1)) / 2 +
          idx * featureLabelSpacer * apolloRowHeight,
        width: '100%',
      }}
    >
      <hr style={hrStyle} />
    </div>
  )
})
