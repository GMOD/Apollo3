import { observer } from 'mobx-react'
import React from 'react'

import HybridGrid from './HybridGrid'
import { ToolBar } from './HybridGrid/ToolBar'
import { type DisplayStateModel } from './types'

function stopPropagation(e: React.MouseEvent) {
  e.stopPropagation()
}

export const TabularEditorPane = observer(function TabularEditorPane({
  model: displayState,
}: {
  model: DisplayStateModel
}) {
  const model = displayState.tabularEditor
  if (!model.isShown) {
    return null
  }
  return (
    // TODO: a11y
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      onMouseDown={stopPropagation}
      onClick={stopPropagation}
      style={{ width: '100%', height: '100%', position: 'relative' }}
    >
      <ToolBar model={displayState} />
      <HybridGrid model={displayState} />
      {/* <DataGrid model={model} /> */}
    </div>
  )
})
