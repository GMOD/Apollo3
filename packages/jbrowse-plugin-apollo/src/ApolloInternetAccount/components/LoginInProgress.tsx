import {
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
  LinearProgress,
} from '@mui/material'
import React from 'react'

import { Dialog } from '../../components/Dialog'

/** Shown while the user logs in through a separate login window */
export function LoginInProgress({
  handleCancel,
  handleShowWindow,
  name,
}: {
  name: string
  handleCancel: () => void
  handleShowWindow: () => void
}) {
  return (
    <Dialog
      open
      title={`Log in to ${name}`}
      handleClose={handleCancel}
      maxWidth="xs"
      data-testid="login-in-progress"
    >
      <DialogContent>
        <DialogContentText>
          Continue in the login window to finish logging in. If you can&apos;t
          see it, it may be behind this browser window.
        </DialogContentText>
        <LinearProgress style={{ marginTop: 16 }} />
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={handleShowWindow}>
          Show login window
        </Button>
        <Button variant="outlined" onClick={handleCancel}>
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  )
}
