import React, { useEffect, useState } from 'react'
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
  MenuItem,
} from '@material-ui/core'
import WarningIcon from '@material-ui/icons/Warning'
import CloseIcon from '@material-ui/icons/Close'
import { ApolloFeature } from '../ApolloFeatureDetail'
import copy from 'copy-to-clipboard'
import EvidenceFormModal from './EvidenceFormModal'

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
  errorText: {
    color: theme.palette.error.main,
  },
}))

// error if form filled out incorrectly, tells user why
function ProvenanceModalError({
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
      data-testid="provenance-editing-modal-error"
      fullWidth={true}
      style={{ zIndex: 2000 }}
    >
      <DialogTitle id="alert-dialog-title">
        <IconButton>
          <WarningIcon />
        </IconButton>
        Invalid Provenance
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
export default function ProvenanceModal({
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
  const [field, setField] = useState('')
  const [evidenceInfo, setEvidenceInfo] = useState({
    evidence: { label: '', id: '', code: '' },
    allECOEvidence: false,
    withArray: [] as string[],
    referenceInfo: { prefix: '', id: '' },
    noteArray: [] as string[],
  })

  const [openErrorModal, setOpenErrorModal] = useState(false)

  const formValidation = () => {
    const errorMessageArray: string[] = []
    if (!field) {
      errorMessageArray.push('You must provide a field')
    }

    if (!evidenceInfo.evidence) {
      errorMessageArray.push('You must provide an ECO term')
    } else if (
      !evidenceInfo.evidence.id.includes(':') &&
      !evidenceInfo.allECOEvidence
    ) {
      errorMessageArray.push(
        'You must provide a prefix and suffix for the ECO term',
      )
    }
    return errorMessageArray
  }

  const clearForm = () => {
    setEvidenceInfo({
      evidence: { label: '', id: '', code: '' },
      allECOEvidence: false,
      withArray: [],
      referenceInfo: { prefix: '', id: '' },
      noteArray: [],
    })
  }

  // loads annotation if selected in datagrid and edit clicked
  useEffect(() => {
    if (Object.keys(loadData).length) {
      const infoToLoad = loadData.selectedAnnotation
      setField(infoToLoad.field || '')
      setEvidenceInfo({
        evidence: {
          label: infoToLoad.evidenceCodeLabel || '',
          id: infoToLoad.evidenceCode || '',
          code: '',
        },
        allECOEvidence: false,
        withArray: infoToLoad.withOrFrom
          ? JSON.parse(infoToLoad.withOrFrom)
          : [],
        referenceInfo: {
          prefix: infoToLoad.reference?.split(':')[0],
          id: infoToLoad.reference?.split(':')[1], // probably a better way to do this, fails if they put a colon in prefix name
        },
        noteArray: infoToLoad.notes ? JSON.parse(infoToLoad.notes) : [],
      })
    }
  }, [loadData])

  return (
    <Dialog
      open
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
      data-testid="provenance-editing-modal"
      fullWidth={true}
    >
      <DialogTitle id="alert-dialog-title">
        Add provenance to {clickedFeature.name}
        <IconButton
          aria-label="close"
          className={classes.closeButton}
          onClick={handleClose}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <Divider />
      <div>
        <DialogContent>
          <DialogContentText>
            Provenance describes why annotation details have been set or changed
          </DialogContentText>
        </DialogContent>
      </div>
      <div className={classes.root}>
        <form>
          <TextField
            select
            label="Field"
            value={field}
            onChange={event => {
              setField(event.target.value)
              clearForm()
            }}
            style={{ width: '30%', marginRight: 10 }}
            helperText={field || ''}
          >
            <MenuItem value="" />
            <MenuItem value="type">TYPE</MenuItem>
            <MenuItem value="symbol">SYMBOL</MenuItem>
            <MenuItem value="name">NAME</MenuItem>
            <MenuItem value="synonym">SYNONYM</MenuItem>
            <MenuItem value="description">DESCRIPTION</MenuItem>
            <MenuItem value="db_xref">DB_XREF</MenuItem>
            <MenuItem value="attribute">ATTRIBUTE</MenuItem>
            <MenuItem value="comment">COMMENT</MenuItem>
          </TextField>
          <EvidenceFormModal
            evidenceInfo={evidenceInfo}
            setEvidenceInfo={setEvidenceInfo}
            disableCondition={false}
            loadData={loadData}
          />
        </form>
      </div>
      <div className={classes.buttons}>
        <Button
          color="primary"
          variant="contained"
          style={{ marginRight: 5 }}
          onClick={async () => {
            const validate = formValidation()
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
                feature: clickedFeature.uniquename,
                field: field,
                evidenceCode: evidenceInfo.evidence.id,
                evidenceCodeLabel: evidenceInfo.evidence.code
                  ? `${evidenceInfo.evidence.code} (${evidenceInfo.evidence.id}): ${evidenceInfo.evidence.label}`
                  : `${evidenceInfo.evidence.label} (${evidenceInfo.evidence.id})`,
                withOrFrom: evidenceInfo.withArray,
                reference: `${evidenceInfo.referenceInfo.prefix}:${evidenceInfo.referenceInfo.id}`,
                id: loadData.selectedAnnotation?.id || null,
                notes: evidenceInfo.noteArray,
              }

              const endpointUrl = Object.keys(loadData).length
                ? `${model.apolloUrl}/provenance/update`
                : `${model.apolloUrl}/provenance/save`
              await fetch(endpointUrl, {
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
        <Button
          color="primary"
          variant="contained"
          onClick={() => {
            const provenanceString = {
              feature: clickedFeature.uniquename,
              field: field,
              evidenceCode: evidenceInfo.evidence.id,
              evidenceCodeLabel: evidenceInfo.evidence.code
                ? `${evidenceInfo.evidence.code} (${evidenceInfo.evidence.id}): ${evidenceInfo.evidence.label}`
                : `${evidenceInfo.evidence.label} (${evidenceInfo.evidence.id})`,
              withOrFrom: evidenceInfo.withArray || [],
              reference: evidenceInfo.referenceInfo.prefix
                ? `${evidenceInfo.referenceInfo.prefix}:${evidenceInfo.referenceInfo.id}`
                : '',
              notes: evidenceInfo.noteArray,
            }
            copy(JSON.stringify(provenanceString, null, 4))
          }}
        >
          Copy JSON to Clipboard
        </Button>
      </div>
      {openErrorModal && (
        <ProvenanceModalError
          handleClose={() => setOpenErrorModal(false)}
          errorMessageArray={formValidation()}
        />
      )}
    </Dialog>
  )
}
