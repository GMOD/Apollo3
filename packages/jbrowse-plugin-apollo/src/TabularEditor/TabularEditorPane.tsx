import CloseIcon from '@mui/icons-material/Close'
import { Autocomplete, IconButton, TextField } from '@mui/material'
import { observer } from 'mobx-react'
import React, { useEffect, useMemo, useState } from 'react'

import { LinearApolloDisplay } from '../LinearApolloDisplay/stateModel'

const ResizeHandle = () => {
  return (
    <div
      style={{
        width: '100%',
        height: '4px',
        position: 'absolute',
        cursor: 'row-resize',
      }}
    />
  )
}

const TabularEditorPane = observer(
  ({ model }: { model: LinearApolloDisplay }) => {
    const {
      selectedFeature,
      setSelectedFeature,
      changeManager,
      detailsHeight,
    } = model
    return (
      <div style={{ width: '100%', position: 'relative' }}>
        <ResizeHandle />
        <IconButton
          aria-label="close"
          style={{ position: 'absolute', right: 0, zIndex: 1 }}
          onClick={() => {
            setSelectedFeature(undefined)
          }}
        >
          <CloseIcon />
        </IconButton>
      </div>
    )
  },
)

export default TabularEditorPane
