import { observer } from 'mobx-react'
import React from 'react'

import { getStrandRow } from '../rows'
import type { LinearApolloSixFrameDisplay } from '../stateModel'

export const TrackLines = observer(function TrackLines({
  model,
  hrStyle = { margin: 0, top: 0, color: 'black' },
  idx,
}: {
  model: LinearApolloSixFrameDisplay
  hrStyle?: React.CSSProperties
  idx: number
}) {
  const { apolloRowHeight, showFeatureLabels } = model
  const featureLabelSpacer = showFeatureLabels ? 2 : 1

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top:
          (getStrandRow(1, showFeatureLabels) + idx * featureLabelSpacer) *
          apolloRowHeight,
        width: '100%',
      }}
    >
      <hr style={hrStyle} />
    </div>
  )
})
