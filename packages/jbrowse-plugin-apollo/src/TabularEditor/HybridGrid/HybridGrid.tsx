import { observer } from 'mobx-react'
import React from 'react'
import { makeStyles } from 'tss-react/mui'

import { DisplayStateModel } from '../types'
import { Feature } from './Feature'

const useStyles = makeStyles()((theme) => ({
  scrollableTable: {
    width: '100%',
    height: '100%',
    th: {
      position: 'sticky',
      top: 0,
      zIndex: 2,
      textAlign: 'left',
      background: 'white',
    },
    td: { whiteSpace: 'normal' },
  },
}))

const HybridGrid = observer(({ model }: { model: DisplayStateModel }) => {
  const { seenFeatures } = model
  const { classes } = useStyles()
  return (
    <table className={classes.scrollableTable}>
      <thead>
        <tr>
          <th>Type</th>
          <th>Start</th>
          <th>End</th>
          <th>Attributes</th>
        </tr>
      </thead>
      <tbody>
        {Array.from(seenFeatures.entries())
          .sort((a, b) => {
            return a[1].start - b[1].start
          })
          .map(([featureId, feature]) => {
            return (
              <Feature
                key={featureId}
                feature={feature}
                model={model}
                depth={0}
              />
            )
          })}
      </tbody>
    </table>
  )
})

export default HybridGrid
