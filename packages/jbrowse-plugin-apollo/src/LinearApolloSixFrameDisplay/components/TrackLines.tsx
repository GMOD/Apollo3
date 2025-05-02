import { observer } from 'mobx-react'
import React from 'react'

import { LinearApolloSixFrameDisplay } from '../stateModel'

export const TrackLines = observer(function TrackLines({
  model,
  strand,
}: {
  model: LinearApolloSixFrameDisplay
  strand: number
}) {
  const { apolloRowHeight, highestRow, lastRowTooltipBufferHeight } = model
  return strand == 1 ? (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: (apolloRowHeight * (highestRow + 1)) / 2 - 2,
        width: '100%',
      }}
    >
      <hr style={{ margin: 0, top: 0, color: 'black' }} />
    </div>
  ) : (
    <div
      style={{
        position: 'absolute',
        left: 0,
        bottom:
          (apolloRowHeight * (highestRow + 1) + lastRowTooltipBufferHeight) /
            2 +
          3,
        width: '100%',
      }}
    >
      <hr style={{ margin: 0, top: 0, color: 'black' }} />
    </div>
  )
})
