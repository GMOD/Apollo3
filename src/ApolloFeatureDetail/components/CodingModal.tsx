import React, { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  Divider,
  makeStyles,
  TextField,
  Button,
  IconButton,
} from '@material-ui/core'
import { ToggleButton, ToggleButtonGroup } from '@material-ui/lab'
import CloseIcon from '@material-ui/icons/Close'
import ArrowBackIcon from '@material-ui/icons/ArrowBack'
import ArrowForwardIcon from '@material-ui/icons/ArrowForward'
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
}))

export default function CodingModal({
  handleClose,
  model,
  clickedFeature,
  loadData,
}: {
  handleClose: () => void
  model: any
  clickedFeature: ApolloFeature
  loadData: any
}) {
  const classes = useStyles()
  const [strand, setStrand] = useState<string | null>(
    `${loadData.selected.location.strand === 1 ? '+' : '-'}`,
  )

  const handleStrand = async (
    event: React.MouseEvent<HTMLElement>,
    newStrand: string | null,
  ) => {
    setStrand(newStrand)
    // fetch to change strand
  }

  return (
    <Dialog
      open
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
      data-testid="coding-editing-modal"
    >
      <DialogTitle id="alert-dialog-title">
        Edit Length
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
          <div style={{ marginRight: 20 }}>
            <TextField disabled placeholder="5' end" style={{ width: '20%' }} />{' '}
            <IconButton
              aria-label="lower"
              disabled={loadData.selected.type.name !== 'exon'}
              style={{ marginTop: 5 }}
              onClick={() => {
                /* sends a signal to ws to decrease fmin of child*/
              }}
            >
              <ArrowBackIcon />
            </IconButton>{' '}
            <TextField
              value={loadData.selected.location.fmin}
              disabled={loadData.selected.type.name !== 'exon'}
              style={{ width: '30%' }}
              onChange={() => {
                /* sends a signal to set fmax */
              }}
            />
            <IconButton
              aria-label="raise"
              disabled={loadData.selected.type.name !== 'exon'}
              style={{ marginTop: 5 }}
              onClick={() => {
                /* sends a signal to ws to increase fmin of child*/
              }}
            >
              <ArrowForwardIcon />
            </IconButton>{' '}
            <br />
            <TextField
              disabled
              placeholder="3' end"
              style={{ width: '20%' }}
            />{' '}
            <IconButton
              aria-label="lower"
              disabled={loadData.selected.type.name !== 'exon'}
              style={{ marginTop: 5 }}
              onClick={() => {
                /* sends a signal to ws to decrease fmax of child*/
              }}
            >
              <ArrowBackIcon />
            </IconButton>{' '}
            <TextField
              value={loadData.selected.location.fmax}
              disabled={loadData.selected.type.name !== 'exon'}
              style={{ width: '30%' }}
              onChange={() => {
                /* sends a signal to set fmax */
              }}
            />
            <IconButton
              aria-label="raise"
              disabled={loadData.selected.type.name !== 'exon'}
              style={{ marginTop: 5 }}
              onClick={() => {
                /* sends a signal to ws to increase fmax of child*/
              }}
            >
              <ArrowForwardIcon />
            </IconButton>{' '}
            <br />
            <TextField
              disabled
              placeholder="strand"
              style={{ width: '20%' }}
            />{' '}
            <ToggleButtonGroup value={strand} onChange={handleStrand} exclusive>
              <ToggleButton value="+">+</ToggleButton>
              <ToggleButton value="-">-</ToggleButton>
            </ToggleButtonGroup>
          </div>
        </form>
      </div>
      <div className={classes.buttons}>
        <Button
          variant="contained"
          style={{ marginRight: 5 }}
          onClick={() => {
            handleClose()
          }}
        >
          Close
        </Button>
      </div>
    </Dialog>
  )
}
