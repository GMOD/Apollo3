/* eslint-disable @typescript-eslint/unbound-method */
import { Dialog } from '@jbrowse/core/ui'
import { Button, DialogActions, DialogContent, Typography } from '@mui/material'
import { observer } from 'mobx-react'
import React, { useState } from 'react'

export const ConfirmChangeDialog = observer(function ({
  handleClose,
  resolve,
  reject,
}: {
  handleClose(): void
  resolve(close: () => void): void
  reject(): void
}) {
  const [pending, setPending] = useState(false)

  return (
    <Dialog open onClose={handleClose} title="Confirm change">
      <DialogContent>
        <Typography>
          {pending ? 'Change in progress…' : 'Confirm change'}
        </Typography>
        <DialogActions>
          <Button
            variant="contained"
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            onClick={async () => {
              setPending(true)
              const close = new Promise<void>((res) => {
                resolve(res)
              })
              await close
              handleClose()
            }}
          >
            Submit
          </Button>
          <Button
            variant="contained"
            color="secondary"
            onClick={() => {
              reject()
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
