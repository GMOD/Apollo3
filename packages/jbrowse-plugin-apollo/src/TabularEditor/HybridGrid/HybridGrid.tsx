import { Menu, MenuItem } from '@jbrowse/core/ui'
import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'
import React, { useEffect, useRef, useState } from 'react'
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
      background: theme.palette.background.paper,
      paddingTop: '3.2em',
    },
    td: { whiteSpace: 'normal' },
  },
  selectedFeature: {
    backgroundColor: theme.palette.action.selected,
  },
}))

export type ContextMenuState = null | {
  position: { top: number; left: number }
  items: MenuItem[]
}

const HybridGrid = observer(function HybridGrid({
  model,
}: {
  model: DisplayStateModel
}) {
  const { apolloHover, seenFeatures, selectedFeature, tabularEditor } = model
  const theme = useTheme()
  const { classes } = useStyles()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null)

  const { filterText } = tabularEditor

  // scrolls to selected feature if one is selected and it's not already visible
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current
    if (scrollContainer && selectedFeature) {
      const selectedRow = scrollContainer.querySelector<HTMLTableRowElement>(
        `.${classes.selectedFeature}`,
      )
      if (selectedRow) {
        const currScroll = scrollContainer.scrollTop
        const newScrollTop = selectedRow.offsetTop - 25
        const isVisible =
          newScrollTop > currScroll &&
          newScrollTop < currScroll + scrollContainer.offsetHeight
        if (!isVisible) {
          scrollContainer.scroll({ top: newScrollTop - 40, behavior: 'smooth' })
        }
      }
    }
  }, [selectedFeature, seenFeatures, classes.selectedFeature])

  return (
    <div
      ref={scrollContainerRef}
      style={{ width: '100%', overflowY: 'auto', height: '100%' }}
    >
      <table className={classes.scrollableTable}>
        <thead>
          <tr>
            <th>Type</th>
            <th>Start</th>
            <th>End</th>
            <th>Strand</th>
            <th>Attributes</th>
          </tr>
        </thead>
        <tbody>
          {[...seenFeatures.entries()]
            .filter((entry) => {
              if (!filterText) {
                return true
              }
              const [, feature] = entry
              // search feature and its subfeatures for the text
              const text = JSON.stringify(feature)
              return text.includes(filterText)
            })
            .sort((a, b) => {
              return a[1].min - b[1].min
            })
            .map(([featureId, feature]) => {
              const isSelected = selectedFeature?._id === featureId
              const isHovered = apolloHover?.feature._id === featureId
              return (
                <Feature
                  key={featureId}
                  isSelected={isSelected}
                  isHovered={isHovered}
                  selectedFeatureClass={classes.selectedFeature}
                  feature={feature}
                  model={model}
                  depth={0}
                  setContextMenu={setContextMenu}
                />
              )
            })}
        </tbody>
      </table>
      <Menu
        open={Boolean(contextMenu)}
        onMenuItemClick={(_, callback) => {
          callback()
          setContextMenu(null)
        }}
        onClose={() => {
          setContextMenu(null)
        }}
        TransitionProps={{
          onExit: () => {
            setContextMenu(null)
          },
        }}
        style={{ zIndex: theme.zIndex.tooltip }}
        menuItems={contextMenu?.items ?? []}
        anchorReference="anchorPosition"
        anchorPosition={contextMenu?.position}
      />
    </div>
  )
})

export default HybridGrid
