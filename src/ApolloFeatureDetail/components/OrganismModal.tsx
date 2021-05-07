import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  makeStyles,
  TextField,
  Button,
  IconButton,
} from '@material-ui/core'
import WarningIcon from '@material-ui/icons/Warning'
import CloseIcon from '@material-ui/icons/Close'
import * as fs from 'fs'
import path from 'path'

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
  errorText: {
    color: theme.palette.error.main,
  },
}))

// error if form filled out incorrectly, tells user why
function OrganismModalError({
  handleClose,
  errorMessageArray,
}: {
  handleClose: () => void
  errorMessageArray: string[]
}) {
  const classes = useStyles()

  return (
    <Dialog
      open
      aria-labelledby="error-dialog-title"
      aria-describedby="error-dialog-description"
      data-testid="organism-modal-error"
      fullWidth={true}
      style={{ zIndex: 2000 }}
    >
      <DialogTitle id="alert-dialog-title">
        <IconButton>
          <WarningIcon />
        </IconButton>
        Invalid Organism
        <IconButton
          aria-label="close"
          className={classes.closeButton}
          onClick={handleClose}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <DialogContentText className={classes.errorText}>
          Reasons:
        </DialogContentText>
        {errorMessageArray.map(reason => (
          <DialogContentText key={reason} className={classes.errorText}>
            {reason}
          </DialogContentText>
        ))}
      </DialogContent>
      <Button
        color="primary"
        variant="contained"
        onClick={() => {
          handleClose()
        }}
      >
        Ok
      </Button>
    </Dialog>
  )
}

export default function OrganismModal({
  handleClose,
  model,
}: {
  handleClose: () => void
  model: any
}) {
  const classes = useStyles()

  // form field hooks
  const [organismInfo, setOrganismInfo] = useState({
    commonName: '',
    genus: '',
    species: '',
    directory: '',
    blatdb: '',
    nonDefaultTranslationTable: '',
    publicMode: false,
    obsolete: false,
  })
  const [openErrorModal, setOpenErrorModal] = useState(false)

  const formValidation = () => {
    const errorMessageArray = []
    if (!organismInfo.commonName) {
      errorMessageArray.push('You must provide a name for the organism')
    }

    // let locationPath: string | undefined
    // locationPath = organismInfo.directory
    // if (locationPath) {
    //   const trackPath = path.join(organismInfo.directory, 'trackList.json')
    //   if (!fs.existsSync(trackPath)) {
    //     errorMessageArray.push(
    //       `Organism directory must be an absolute path pointing to 'trackList.json`,
    //     )
    //   }
    // } else {
    //   errorMessageArray.push(
    //     `Organism directory must be an absolute path pointing to 'trackList.json`,
    //   )
    // }
    return errorMessageArray
  }

  return (
    <Dialog
      open
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
      data-testid="comment-editing-modal"
      fullWidth={true}
    >
      <DialogTitle id="alert-dialog-title">
        Add Organism
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
        <TextField
          key={`name-${organismInfo.commonName}`}
          label="Name"
          defaultValue={organismInfo.commonName}
          onBlur={async event => {
            setOrganismInfo({ ...organismInfo, commonName: event.target.value })
          }}
        />{' '}
        <TextField
          key={`genus-${organismInfo.genus}`}
          label="Genus"
          defaultValue={organismInfo.genus}
          onBlur={async event => {
            setOrganismInfo({ ...organismInfo, genus: event.target.value })
          }}
        />{' '}
        <TextField
          key={`species-${organismInfo.species}`}
          label="Species"
          defaultValue={organismInfo.species}
          onBlur={async event => {
            setOrganismInfo({ ...organismInfo, species: event.target.value })
          }}
        />
        <br />
        <TextField
          key={organismInfo.directory}
          label="Directory"
          defaultValue={organismInfo.directory}
          style={{ width: '80%' }}
          onChange={async event => {
            setOrganismInfo({ ...organismInfo, directory: event.target.value })
          }}
        />{' '}
        <br />
        <TextField
          key={`${organismInfo}-blatdb`}
          label="Search database"
          defaultValue={organismInfo.blatdb}
          style={{ width: '80%' }}
          onChange={async event => {
            setOrganismInfo({ ...organismInfo, blatdb: event.target.value })
          }}
        />{' '}
        <br />
        <TextField
          key={`${organismInfo}-translationtable`}
          label="Non-default Translation Table"
          defaultValue={organismInfo.nonDefaultTranslationTable}
          style={{ width: '80%' }}
          onChange={async event => {
            setOrganismInfo({
              ...organismInfo,
              nonDefaultTranslationTable: event.target.value,
            })
          }}
        />
        <br />
        <input
          id="Public"
          type="checkbox"
          checked={organismInfo.publicMode}
          onChange={async event => {
            setOrganismInfo({
              ...organismInfo,
              publicMode: event.target.checked,
            })
          }}
          style={{ marginTop: 40 }}
        />
        <label htmlFor="not">Public</label>
        <input
          id="not"
          type="checkbox"
          checked={organismInfo.obsolete}
          onChange={async event => {
            setOrganismInfo({
              ...organismInfo,
              obsolete: event.target.checked,
            })
          }}
          style={{ marginTop: 40 }}
        />
        <label htmlFor="not">Obsolete</label>
      </div>
      <div className={classes.buttons}>
        <Button
          color="primary"
          variant="contained"
          style={{ marginRight: 5 }}
          onClick={async () => {
            const validate = await formValidation()
            if (validate.length > 0) {
              setOpenErrorModal(true)
            } else {
              const data = {
                username: sessionStorage.getItem(
                  `${model.apolloId}-apolloUsername`,
                ),
                password: sessionStorage.getItem(
                  `${model.apolloId}-apolloPassword`,
                ),
                ...organismInfo,
              }

              await fetch(`${model.apolloUrl}/organism/addOrganism`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
              })
              handleClose()
            }
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
      {openErrorModal && (
        <OrganismModalError
          handleClose={() => setOpenErrorModal(false)}
          errorMessageArray={formValidation()}
        />
      )}
    </Dialog>
  )
}
