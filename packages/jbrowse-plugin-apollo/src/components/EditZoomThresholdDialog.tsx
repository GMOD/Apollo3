import { Dialog } from '@jbrowse/core/ui'
import {
  Button,
  DialogActions,
  DialogContent,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'
import React, { useState } from 'react'

const EditZoomThresholdDialog = observer(function ({
  model,
  handleClose,
}: {
  model: {
    zoomThresholdSetting: number
    setZoomThresholdSetting: (a: { zoomThreshold: number }) => void
  }
  handleClose: () => void
}) {
  const [zoomThreshold, setZoomThreshold] = useState(
    `${model.zoomThresholdSetting}`,
  )

  return (
    <Dialog open onClose={handleClose} title="Edit zoom threshold setting">
      <DialogContent>
        <Typography>
          The zoom level in base pairs (bp) per pixel at which features are
          rendered in this Annotations track. Increasing the value will allow
          features to render when zooming out, but might impact performance.
        </Typography>
        <TextField
          label="Threshold value (bpPerPx)"
          value={zoomThreshold}
          onChange={(event) => {
            setZoomThreshold(event.target.value)
          }}
        />

        <DialogActions>
          <Button
            variant="contained"
            onClick={() => {
              model.setZoomThresholdSetting({
                zoomThreshold: +zoomThreshold,
              })
              handleClose()
            }}
          >
            Submit
          </Button>
          <Button
            variant="contained"
            color="secondary"
            onClick={() => {
              handleClose()
            }}
          >
            Cancel
          </Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  )
})

export default EditZoomThresholdDialog
