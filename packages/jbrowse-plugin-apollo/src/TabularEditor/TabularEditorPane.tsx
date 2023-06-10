import CloseIcon from '@mui/icons-material/Close'
import { IconButton } from '@mui/material'
import { observer } from 'mobx-react'
import React, { useCallback } from 'react'

import DataGrid from './DataGrid'
import HybridGrid from './HybridGrid'
import { DisplayStateModel } from './types'

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
    model: DisplayStateModel
    onResize: (sizeDelta: number) => void
  }) => {
    const { selectedFeature, setSelectedFeature } = model
    if (!selectedFeature) {
      return null
    }
    const stopPropagation = (e: React.MouseEvent) => e.stopPropagation()
    return (
      <div
        onMouseDown={stopPropagation}
        onClick={stopPropagation}
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
        }}
      >
        <ResizeHandle onResize={onResize} />
        <IconButton
          aria-label="close"
          style={{ position: 'absolute', top: 0, right: 15, zIndex: 5 }}
          onClick={() => {
            setSelectedFeature(undefined)
          }}
        >
          <CloseIcon />
        </IconButton>
        <HybridGrid model={model} />
        {/* <DataGrid model={model} /> */}
      </div>
    )
  },
)

export default TabularEditorPane
