import { observer } from 'mobx-react'
import React, { useEffect, useRef } from 'react'
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
  selectedFeature: {
    backgroundColor: theme.palette.secondary.light,
    td: {
      borderColor: theme.palette.secondary.light,
    },
  },
}))

const HybridGrid = observer(({ model }: { model: DisplayStateModel }) => {
  const { seenFeatures, selectedFeature } = model
  const seenFeaturesArray = Array.from(seenFeatures.entries())
  const { classes } = useStyles()
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // scrolls to selected feature if one is selected
  useEffect(() => {
    if (scrollContainerRef.current && selectedFeature) {
      const selectedRow = scrollContainerRef.current.querySelector(
        `.${classes.selectedFeature}`,
      ) as HTMLElement | null
      if (selectedRow) {
        scrollContainerRef.current.scroll({
          top: selectedRow.offsetTop - 40,
          behavior: 'smooth',
        })
      }
    }
  }, [selectedFeature, seenFeatures, classes.selectedFeature])

  return (
    <div
      ref={scrollContainerRef}
      style={{
        width: '100%',
        overflowY: 'auto',
        height: '100%',
      }}
    >
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
          {seenFeaturesArray
            .sort((a, b) => {
              return a[1].start - b[1].start
            })
            .map(([featureId, feature]) => {
              return (
                <Feature
                  key={featureId}
                  selectedFeature={selectedFeature}
                  selectedFeatureClass={classes.selectedFeature}
                  feature={feature}
                  model={model}
                  depth={0}
                />
              )
            })}
        </tbody>
      </table>
    </div>
  )
})

export default HybridGrid
