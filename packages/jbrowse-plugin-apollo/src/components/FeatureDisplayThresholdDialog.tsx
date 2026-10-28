import { Dialog } from '@jbrowse/core/ui'
import {
  Button,
  DialogActions,
  DialogContent,
  FormControlLabel,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'
import React, { useState } from 'react'

import type { ThresholdMode } from '../util/featureDensityModel'

function isPositiveNumber(value: string) {
  return value.trim() !== '' && Number(value) > 0
}

const FeatureDisplayThresholdDialog = observer(function ({
  model,
  handleClose,
}: {
  model: {
    thresholdModeSetting: ThresholdMode
    maxFeatureCountSetting: number
    zoomThresholdSetting: number
    setFeatureDisplayThreshold: (a: {
      mode: ThresholdMode
      maxFeatureCount: number
      zoomThreshold: number
    }) => void
  }
  handleClose: () => void
}) {
  const [mode, setMode] = useState<ThresholdMode>(model.thresholdModeSetting)
  const [maxFeatureCount, setMaxFeatureCount] = useState(
    `${model.maxFeatureCountSetting}`,
  )
  const [zoomThreshold, setZoomThreshold] = useState(
    `${model.zoomThresholdSetting}`,
  )
  const maxFeatureCountValid = isPositiveNumber(maxFeatureCount)
  const zoomThresholdValid = isPositiveNumber(zoomThreshold)
  const valid = mode === 'auto' ? maxFeatureCountValid : zoomThresholdValid

  return (
    <Dialog open onClose={handleClose} title="Feature display threshold">
      <DialogContent>
        <Typography>
          When there are too many features in view, a histogram of feature
          density is shown instead of the features. Showing more features might
          impact performance.
        </Typography>
        <RadioGroup
          value={mode}
          onChange={(event) => {
            setMode(event.target.value as ThresholdMode)
          }}
        >
          <FormControlLabel
            value="auto"
            control={<Radio />}
            label="Automatic: show features when the number in view is at most"
          />
          <TextField
            label="Maximum features"
            value={maxFeatureCount}
            disabled={mode !== 'auto'}
            error={mode === 'auto' && !maxFeatureCountValid}
            onChange={(event) => {
              setMaxFeatureCount(event.target.value)
            }}
            slotProps={{ htmlInput: { 'data-testid': 'max-feature-count' } }}
            style={{ marginLeft: 32 }}
          />
          <FormControlLabel
            value="fixed"
            control={<Radio />}
            label="Fixed zoom level: show features when zoomed in to less than"
          />
          <TextField
            label="Base pairs per pixel"
            value={zoomThreshold}
            disabled={mode !== 'fixed'}
            error={mode === 'fixed' && !zoomThresholdValid}
            onChange={(event) => {
              setZoomThreshold(event.target.value)
            }}
            slotProps={{ htmlInput: { 'data-testid': 'zoom-threshold' } }}
            style={{ marginLeft: 32 }}
          />
        </RadioGroup>

        <DialogActions>
          <Button
            variant="contained"
            disabled={!valid}
            onClick={() => {
              model.setFeatureDisplayThreshold({
                mode,
                maxFeatureCount: maxFeatureCountValid
                  ? Number(maxFeatureCount)
                  : model.maxFeatureCountSetting,
                zoomThreshold: zoomThresholdValid
                  ? Number(zoomThreshold)
                  : model.zoomThresholdSetting,
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

export default FeatureDisplayThresholdDialog
