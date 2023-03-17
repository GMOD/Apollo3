import { observer } from 'mobx-react'
import React from 'react'

import { SixFrameFeatureDisplay } from '../stateModel'

export const TrackLines = observer(
  ({ model }: { model: SixFrameFeatureDisplay }) => {
    const { height } = model
    return (
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: height / 2,
          width: '100%',
        }}
      >
        <hr style={{ margin: 0, top: 0, color: 'black' }} />
      </div>
    )
  },
)
