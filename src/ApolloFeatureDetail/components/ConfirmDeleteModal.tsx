import {
  Dialog,
  DialogTitle,
  makeStyles,
  Button,
  IconButton,
} from '@material-ui/core'
import CloseIcon from '@material-ui/icons/Close'
import React from 'react'

const useStyles = makeStyles(theme => ({
  closeButton: {
    position: 'absolute',
    right: theme.spacing(1),
    top: theme.spacing(1),
    color: theme.palette.grey[500],
  },
  buttons: {
    margin: theme.spacing(2),
  },
}))

export default function ConfirmDeleteModal({
  handleClose,
  deleteFunc,
  objToDeleteName,
}: {
  handleClose: () => void
  deleteFunc: () => void
  objToDeleteName: string
}) {
  const classes = useStyles()

  return (
    <Dialog
      open
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-description"
      data-testid="confirm-delete-modal"
      fullWidth={true}
      style={{ zIndex: 2000 }}
    >
      <DialogTitle id="alert-dialog-title">
        Delete {objToDeleteName}?
        <IconButton
          aria-label="close"
          className={classes.closeButton}
          onClick={handleClose}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <div style={{ marginRight: 5, alignSelf: 'flex-end' }}>
        <Button
          className={classes.buttons}
          color="primary"
          variant="contained"
          onClick={() => {
            deleteFunc()
            handleClose()
          }}
        >
          Ok
        </Button>
        <Button
          className={classes.buttons}
          variant="contained"
          onClick={() => {
            handleClose()
          }}
        >
          Cancel
        </Button>
      </div>
    </Dialog>
  )
}
