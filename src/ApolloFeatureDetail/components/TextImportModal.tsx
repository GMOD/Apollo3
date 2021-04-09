import {
  Dialog,
  DialogTitle,
  makeStyles,
  Button,
  IconButton,
  TextField,
} from '@material-ui/core'
import CloseIcon from '@material-ui/icons/Close'
import React, { useState } from 'react'

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

export default function TextImportModal({
  model,
  handleClose,
  endpointUrl,
  from,
  helpText,
}: {
  model: any
  handleClose: () => void
  endpointUrl: string
  from: string
  helpText: string
}) {
  const classes = useStyles()
  const [text, setText] = useState('')

  return (
    <div style={{ height: '400px' }}>
      <Dialog
        open
        aria-labelledby="import-dialog-title"
        aria-describedby="import-dialog-description"
        data-testid="import-modal"
        fullWidth={true}
      >
        <DialogTitle id="alert-dialog-title">
          Paste text string below to import {from}
          <IconButton
            aria-label="close"
            className={classes.closeButton}
            onClick={handleClose}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <TextField
          value={text}
          onChange={event => {
            setText(event.target.value)
          }}
          label="Paste Import Text Here"
          autoComplete="off"
          placeholder={helpText}
          size="medium"
          style={{ margin: 10 }}
          multiline
          rows={10}
        />
        <div style={{ marginRight: 5, alignSelf: 'flex-end' }}>
          <Button
            className={classes.buttons}
            color="primary"
            variant="contained"
            onClick={async () => {
              let JSONtext
              try {
                JSONtext = JSON.parse(text)
              } catch (err) {
                console.log(err)
              }
              try {
                const data = {
                  username: sessionStorage.getItem(
                    `${model.apolloId}-apolloUsername`,
                  ),
                  password: sessionStorage.getItem(
                    `${model.apolloId}-apolloPassword`,
                  ),
                  ...JSONtext,
                }
                const response = await fetch(endpointUrl, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(data),
                })
              } catch (err) {
                console.log(err)
              }
              handleClose()
            }}
          >
            Import JSON
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
    </div>
  )
}
