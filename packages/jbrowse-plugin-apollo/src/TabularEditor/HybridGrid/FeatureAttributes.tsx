/* eslint-disable @typescript-eslint/restrict-template-expressions */
import { type AnnotationFeature } from '@apollo-annotation/mst'
import { getSnapshot } from '@jbrowse/mobx-state-tree'
import { observer } from 'mobx-react'
import React from 'react'

import Highlight from './Highlight'

export const FeatureAttributes = observer(function FeatureAttributes({
  feature,
  filterText,
}: {
  feature: AnnotationFeature
  filterText: string
}) {
  const attrString = [...feature.attributes.entries()]
    .map(([key, value]) => {
      if (key.startsWith('gff_')) {
        const newKey = key.slice(4)
        const capitalizedKey = newKey.charAt(0).toUpperCase() + newKey.slice(1)
        return [capitalizedKey, getSnapshot(value)]
      }
      if (key === '_id') {
        return ['ID', getSnapshot(value)]
      }
      return [key, getSnapshot(value)]
    })
    .filter(([key]) => key) // Leave empty keys off
    .map(
      ([key, values]) =>
        `${key}=${Array.isArray(values) ? values.join(', ') : values}`,
    )
    .join(', ')

  return <Highlight text={attrString} highlight={filterText} />
})
