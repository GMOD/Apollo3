import CloseIcon from '@mui/icons-material/Close'
import { IconButton } from '@mui/material'
import { observer } from 'mobx-react'
import React, { useCallback, useRef, useState } from 'react'

import { LinearApolloDisplay } from '../LinearApolloDisplay/stateModel'
import DataGrid from './DataGrid'

const ResizeHandle = ({
  onResize,
}: {
  onResize: (sizeDelta: number) => void
}) => {
  const mouseMove = useCallback(
    (event: MouseEvent) => {
      event.stopPropagation()
      event.preventDefault()
      onResize(event.movementY)
    },
    [onResize],
  )
  const cancelDrag: () => void = useCallback(() => {
    window.removeEventListener('mousemove', mouseMove)
    window.removeEventListener('mouseup', cancelDrag)
    window.removeEventListener('mouseleave', cancelDrag)
  }, [mouseMove])
  return (
    <div
      onMouseDown={(event: React.MouseEvent) => {
        event.stopPropagation()
        window.addEventListener('mousemove', mouseMove)
        window.addEventListener('mouseup', cancelDrag)
        window.addEventListener('mouseleave', cancelDrag)
      }}
      style={{
        width: '100%',
        height: '4px',
        position: 'absolute',
        cursor: 'row-resize',
        zIndex: 100,
      }}
    />
  )
}

const TabularEditorPane = observer(
  ({
    model,
    onResize,
  }: {
    model: LinearApolloDisplay
    onResize: (sizeDelta: number) => void
  }) => {
    const { selectedFeature, setSelectedFeature } = model
    if (!selectedFeature) {
      return null
    }
    return (
      <div style={{ width: '100%', position: 'relative' }}>
        <ResizeHandle onResize={onResize} />
        <IconButton
          aria-label="close"
          style={{ position: 'absolute', right: 0, zIndex: 1 }}
          onClick={() => {
            setSelectedFeature(undefined)
          }}
        >
          <CloseIcon />
        </IconButton>
        <DataGrid model={model} />
      </div>
    )
  },
)

export default TabularEditorPane
