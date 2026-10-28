import { BaseTooltip } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'
import React from 'react'

import type { Coord } from '../../util/displayUtils'
import type { LinearApolloSixFrameDisplay } from '../stateModel'

interface LinearApolloSixFrameDisplayTooltipProps {
  mouseCoordinate: Coord | undefined
  model: LinearApolloSixFrameDisplay
}

export const Tooltip = observer(function Tooltip(
  props: LinearApolloSixFrameDisplayTooltipProps,
) {
  const { mouseCoordinate, model } = props
  const { apolloDragging, hoveredFeature } = model

  if (!(mouseCoordinate && hoveredFeature) || apolloDragging) {
    return
  }
  const lines = model.getGlyph(hoveredFeature.feature).getTooltipLines(model)
  if (!lines) {
    return
  }
  const [x, y] = mouseCoordinate
  return (
    <BaseTooltip clientPoint={{ x, y }} placement="top-start">
      {lines.map((line, idx) => (
        <React.Fragment key={line}>
          {idx > 0 ? <br /> : null}
          {line}
        </React.Fragment>
      ))}
    </BaseTooltip>
  )
})
