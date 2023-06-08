import CloseIcon from '@mui/icons-material/Close'
import { IconButton } from '@mui/material'
import { observer } from 'mobx-react'
import React from 'react'

import { LinearApolloDisplay } from '../LinearApolloDisplay/stateModel'
import DataGrid from './DataGrid'

// const ResizeHandle = () => {
//   return (
//     <div
//       style={{
//         width: '100%',
//         height: '4px',
//         position: 'absolute',
//         cursor: 'row-resize',
//       }}
//     />
//   )
// }

const TabularEditorPane = observer(
  ({ model }: { model: LinearApolloDisplay }) => {
    const { selectedFeature, setSelectedFeature } = model
    if (!selectedFeature) {
      return null
    }
    return (
      <div style={{ width: '100%', position: 'relative' }}>
        {/* <ResizeHandle /> */}
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
