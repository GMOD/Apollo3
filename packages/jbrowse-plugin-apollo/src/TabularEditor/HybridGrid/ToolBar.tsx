import ClearIcon from '@mui/icons-material/Clear'
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess'
import { IconButton, InputAdornment, TextField, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'
import React from 'react'
import { makeStyles } from 'tss-react/mui'

import { DisplayStateModel } from '../types'

const useStyles = makeStyles()({
  toolbar: {
    width: '100%',
    display: 'flex',
    paddingRight: '2em',
    flexDirection: 'row',
    justifyContent: 'space-between',
    position: 'absolute',
    zIndex: 4,
  },
  filterText: {},
})
export const ToolBar = observer(function ToolBar({
  model: displayState,
}: {
  model: DisplayStateModel
}) {
  const model = displayState.tabularEditor
  const { classes } = useStyles()
  return (
    <div className={classes.toolbar}>
      <Tooltip title="Collapse all">
        <IconButton
          aria-label="collapse"
          sx={{ marginTop: 0 }}
          onClick={model.collapseAllFeatures}
        >
          <UnfoldLessIcon />
        </IconButton>
      </Tooltip>
      <TextField
        className={classes.filterText}
        label="Filter features"
        value={model.filterText}
        sx={{ marginTop: 0 }}
        variant="outlined"
        onChange={(event) => model.setFilterText(event.target.value)}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <IconButton onClick={() => model.clearFilterText()}>
                <ClearIcon />
              </IconButton>
            </InputAdornment>
          ),
        }}
      />
    </div>
  )
})
