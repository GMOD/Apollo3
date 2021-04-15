import React, { useEffect, useState } from 'react'
import {
  Dialog,
  DialogTitle,
  Divider,
  makeStyles,
  TextField,
  Button,
  IconButton,
} from '@material-ui/core'
import CloseIcon from '@material-ui/icons/Close'
import { ApolloFeature } from '../ApolloFeatureDetail'

const useStyles = makeStyles(theme => ({
  main: {
    textAlign: 'center',
    margin: theme.spacing(2),
    padding: theme.spacing(2),
    borderWidth: 2,
    borderRadius: 2,
  },
  buttons: {
    margin: theme.spacing(2),
    color: theme.palette.text.primary,
  },
  root: {
    width: '100%',
    padding: theme.spacing(2),
  },
  closeButton: {
    position: 'absolute',
    right: theme.spacing(1),
    top: theme.spacing(1),
    color: theme.palette.grey[500],
  },
  prefixIdField: {
    '& .MuiTextField-root': {
      marginRight: theme.spacing(1),
    },
  },
}))

export default function CommentModal({
  handleClose,
  model,
  clickedFeature,
  loadData = {},
}: {
  handleClose: () => void
  model: any
  clickedFeature: ApolloFeature
  loadData: any
}) {
  const classes = useStyles()

  // form field hooks
  const [comment, setComment] = useState('')

  // loads annotation if selected in datagrid and edit clicked
  useEffect(() => {
    if (loadData) {
      setComment(loadData)
    }
  }, [loadData])

  return (
    <Dialog
      open
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
      data-testid="comment-editing-modal"
      fullWidth={true}
    >
      <DialogTitle id="alert-dialog-title">
        Add Comment to {clickedFeature.name}
        <IconButton
          aria-label="close"
          className={classes.closeButton}
          onClick={handleClose}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <Divider />
      <div className={classes.root}>
        <form>
          <TextField
            value={comment}
            onChange={event => {
              setComment(event.target.value)
            }}
            label="Add Comments here"
            autoComplete="off"
            size="medium"
            style={{ margin: 10, width: '80%' }}
            multiline
            rows={10}
          />
        </form>
      </div>
      <div className={classes.buttons}>
        <Button
          color="primary"
          variant="contained"
          style={{ marginRight: 5 }}
          onClick={async () => {
            const data = !loadData
              ? {
                  username: sessionStorage.getItem(
                    `${model.apolloId}-apolloUsername`,
                  ),
                  password: sessionStorage.getItem(
                    `${model.apolloId}-apolloPassword`,
                  ),
                  features: [
                    {
                      uniquename: clickedFeature.uniquename,
                      comments: [comment],
                    },
                  ],
                }
              : {
                  username: sessionStorage.getItem(
                    `${model.apolloId}-apolloUsername`,
                  ),
                  password: sessionStorage.getItem(
                    `${model.apolloId}-apolloPassword`,
                  ),
                  features: [
                    {
                      uniquename: clickedFeature.uniquename,
                      old_comments: [loadData],
                      new_comments: [comment],
                    },
                  ],
                }

            const endpointUrl = loadData
              ? `${model.apolloUrl}/annotationEditor/updateComments`
              : `${model.apolloUrl}/annotationEditor/addComments`
            await fetch(endpointUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(data),
            })
            handleClose()
          }}
        >
          Save
        </Button>
        <Button
          variant="contained"
          style={{ marginRight: 5 }}
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
