import { BaseTooltip } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'
import React from 'react'

import type { ApolloSessionModel } from '../../session'
import type { Coord } from '../../util/displayUtils'

interface LinearApolloDisplayProps {
  mouseCooordinate: Coord | undefined
  session: ApolloSessionModel
}

export const Tooltip = observer(function Tooltip(
  props: LinearApolloDisplayProps,
) {
  const { mouseCooordinate, session } = props
  const { apolloHoveredFeature } = session

  if (!(mouseCooordinate && apolloHoveredFeature)) {
    return
  }
  const [x, y] = mouseCooordinate
  const { feature } = apolloHoveredFeature
  const { attributes, min, max } = feature
  const location = `Loc: ${min + 1}..${max}`
  const featureType = `Type: ${feature.type}`
  const featureName = attributes.get('gff_name')?.find((name) => name !== '')
  return (
    <BaseTooltip clientPoint={{ x, y }} placement="top-start">
      {featureType}
      <br />
      {featureName ? (
        <>
          {featureName}
          <br />
        </>
      ) : null}
      {location}
    </BaseTooltip>
  )
})
