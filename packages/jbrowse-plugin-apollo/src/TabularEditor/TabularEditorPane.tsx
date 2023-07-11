import { observer } from 'mobx-react'
import React from 'react'

import HybridGrid from './HybridGrid'
import { ToolBar } from './HybridGrid/ToolBar'
import { DisplayStateModel } from './types'

export const TabularEditorPane = observer(
  ({ model: displayState }: { model: DisplayStateModel }) => {
    const model = displayState.tabularEditor
    if (!model.isShown) {
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
        <ToolBar model={displayState} />
        <HybridGrid model={displayState} />
        {/* <DataGrid model={model} /> */}
      </div>
    )
  },
)
