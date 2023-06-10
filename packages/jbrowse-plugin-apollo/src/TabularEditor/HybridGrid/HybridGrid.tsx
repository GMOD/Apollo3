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
  const { classes } = useStyles()
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // scrolls to selected feature if one is selected and it's not already visible
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current
    if (scrollContainer && selectedFeature) {
      const selectedRow = scrollContainer.querySelector(
        `.${classes.selectedFeature}`,
      ) as HTMLElement | null
      if (selectedRow) {
        const currScroll = scrollContainer.scrollTop
        const newScrollTop = selectedRow.offsetTop - 25
        const isVisible =
          newScrollTop > currScroll &&
          newScrollTop < currScroll + scrollContainer.offsetHeight
        if (!isVisible) {
          scrollContainer.scroll({
            top: newScrollTop - 20,
            behavior: 'smooth',
          })
        }
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
          {Array.from(seenFeatures.entries())
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
