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
import { Autocomplete } from '@material-ui/lab'
import WarningIcon from '@material-ui/icons/Warning'
import CloseIcon from '@material-ui/icons/Close'
import { ApolloFeature } from '../ApolloFeatureDetail'
import GOEvidenceCodes from './GOEvidenceCodes'
import copy from 'copy-to-clipboard'

interface GoResults {
  id: string
  label: string[]
}

interface EvidenceResults extends GoResults {
  code: string
}

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
// geneonotogy endpoing for GO Term and evidence autocompletes
// may move to a utils file if used for more than one folder
const fetchEvidenceAutocompleteResults = async (currentText: string) => {
  const data = {
    rows: 40,
    prefix: 'ECO',
  }

  let params = Object.entries(data)
    .map(([key, val]) => `${key}=${encodeURIComponent(val)}`)
    .join('&')

  const response = await fetch(
    `https://api.geneontology.org/api/search/entity/autocomplete/${currentText}?${params}`,
    {
      method: 'GET',
    },
  )

  const results = await response.json()
  return results
}

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
      data-testid="go-editing-modal-error"
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
  const [provenanceFormInfo, setProvenanceFormInfo] = useState({
    field: '',
    evidence: { label: '', id: '', code: '' },
    allECOEvidence: false,
  })
  const [evidenceAutocomplete, setEvidenceAutocomplete] = useState<
    EvidenceResults[]
  >([])
  const initialPrefixId = { prefix: '', id: '' }
  const [withInfo, setWithInfo] = useState(initialPrefixId)
  const [withArray, setWithArray] = useState<string[]>([])
  const [referenceInfo, setReferenceInfo] = useState({ prefix: '', id: '' })
  const [noteString, setNoteString] = useState('')
  const [noteArray, setNoteArray] = useState<string[]>([])

  const [openErrorModal, setOpenErrorModal] = useState(false)

  const formValidation = () => {
    const errorMessageArray: string[] = []
    if (!provenanceFormInfo.field) {
      errorMessageArray.push('You must provide a field')
    }

    if (!provenanceFormInfo.evidence) {
      errorMessageArray.push('You must provide an ECO term')
    } else if (
      !provenanceFormInfo.evidence.id.includes(':') &&
      !provenanceFormInfo.allECOEvidence
    ) {
      errorMessageArray.push(
        'You must provide a prefix and suffix for the ECO term',
      )
    }
    if (!referenceInfo.prefix || !referenceInfo.id) {
      errorMessageArray.push(
        'You must provide atleast one reference prefix and id',
      )
    }
    if (withArray.length <= 0) {
      errorMessageArray.push(
        'You must provide at least 1 with for the evidence code',
      )
    }
    return errorMessageArray
  }

  const clearForm = () => {
    setProvenanceFormInfo({
      field: '',
      evidence: { label: '', id: '', code: '' },
      allECOEvidence: false,
    })
    setWithInfo(initialPrefixId)
    setWithArray([])
    setReferenceInfo(initialPrefixId)
    setNoteString('')
    setNoteArray([])
  }

  // loads annotation if selected in datagrid and edit clicked
  useEffect(() => {
    if (Object.keys(loadData).length) {
      const infoToLoad = loadData.selectedAnnotation
      setProvenanceFormInfo({
        field: infoToLoad.field || '',
        evidence: {
          label: infoToLoad.evidenceCodeLabel || '',
          id: infoToLoad.evidenceCode || '',
          code: '',
        },
        allECOEvidence: false,
      })
      setWithArray(
        infoToLoad.withOrFrom ? JSON.parse(infoToLoad.withOrFrom) : [],
      )
      setReferenceInfo({
        prefix: infoToLoad.reference?.split(':')[0],
        id: infoToLoad.reference?.split(':')[1], // probably a better way to do this, fails if they put a colon in prefix name
      })
      setNoteArray(infoToLoad.notes ? JSON.parse(infoToLoad.notes) : [])
    }
  }, [loadData])

  return (
    <Dialog
      open
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
      data-testid="gene-product-editing-modal"
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
            value={provenanceFormInfo.field}
            onChange={event => {
              setProvenanceFormInfo({
                ...provenanceFormInfo,
                field: event.target.value,
              })
              clearForm()
            }}
            style={{ width: '30%', marginRight: 10 }}
            helperText={provenanceFormInfo.field || ''}
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
          <Autocomplete
            id="evidence-autocomplete"
            freeSolo
            options={evidenceAutocomplete}
            value={provenanceFormInfo.evidence.id}
            getOptionLabel={option => {
              if (typeof option === 'string') {
                return option
              }
              if (option.label) {
                return !option.code
                  ? `${option.label[0]} (${option.id})`
                  : `${option.code} (${option.id}): ${option.label[0]}`
              }
              return option.id
            }}
            onChange={(event, value, reason) => {
              if (reason === 'clear') {
                setProvenanceFormInfo({
                  ...provenanceFormInfo,
                  evidence: {
                    label: '',
                    id: '',
                    code: '',
                  },
                })
              }
              if (value) {
                setProvenanceFormInfo({
                  ...provenanceFormInfo,
                  evidence: {
                    label: (value as EvidenceResults).label[0],
                    id: (value as EvidenceResults).id,
                    code: (value as EvidenceResults).code || '',
                  },
                })
              }
            }}
            selectOnFocus
            renderInput={params => (
              <TextField
                {...params}
                // value={goFormInfo.evidence.id}
                onChange={async event => {
                  setProvenanceFormInfo({
                    ...provenanceFormInfo,
                    evidence: {
                      label: '',
                      code: '',
                      id: event.target.value,
                    },
                  })

                  if (provenanceFormInfo.allECOEvidence) {
                    const result = await fetchEvidenceAutocompleteResults(
                      event.target.value,
                    )
                    setEvidenceAutocomplete(result.docs)
                  } else {
                    setEvidenceAutocomplete(
                      GOEvidenceCodes.filter(
                        info =>
                          info.code.includes(event.target.value) ||
                          info.label[0].includes(event.target.value),
                      ),
                    )
                  }
                }}
                label="Evidence"
                autoComplete="off"
                style={{ width: '70%' }}
                helperText={
                  <>
                    {provenanceFormInfo.evidence.label &&
                      provenanceFormInfo.evidence.id && (
                        <a
                          href={`https://evidenceontology.org/term/${provenanceFormInfo.evidence.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {provenanceFormInfo.evidence.label} (
                          {provenanceFormInfo.evidence.id})
                        </a>
                      )}
                    {provenanceFormInfo.evidence.label &&
                      provenanceFormInfo.evidence.id && <br />}
                    <a
                      href="http://geneontology.org/docs/guide-go-evidence-codes/"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Evidence Code Info
                    </a>
                  </>
                }
              />
            )}
          />

          <input
            id="allECOEvidence"
            type="checkbox"
            checked={provenanceFormInfo.allECOEvidence}
            onChange={event => {
              setProvenanceFormInfo({
                ...provenanceFormInfo,
                allECOEvidence: event.target.checked,
              })
            }}
            style={{ marginTop: 40, marginRight: 10 }}
          />
          <label htmlFor="allECOEvidence">All ECO Evidence</label>
          <br />
          <div className={classes.prefixIdField}>
            <TextField
              value={withInfo.prefix}
              onChange={event => {
                setWithInfo({ ...withInfo, prefix: event.target.value })
              }}
              label="With"
              autoComplete="off"
              placeholder="Prefix"
            />
            <TextField
              value={withInfo.id}
              onChange={event => {
                setWithInfo({ ...withInfo, id: event.target.value })
              }}
              label="With Id"
              autoComplete="off"
              placeholder="id"
            />
            <Button
              color="primary"
              variant="contained"
              style={{ marginTop: 20 }}
              onClick={() => {
                if (withInfo !== initialPrefixId) {
                  const prefixIdString = `${withInfo.prefix}:${withInfo.id}`
                  withArray.length > 0
                    ? setWithArray([...withArray, prefixIdString])
                    : setWithArray([prefixIdString])
                  setWithInfo(initialPrefixId)
                }
              }}
            >
              Add
            </Button>
            {withArray.map((value: string) => {
              return (
                <div key={value}>
                  {value}
                  <IconButton
                    aria-label="close"
                    onClick={() => {
                      setWithArray(
                        withArray.filter(withString => withString !== value),
                      )
                    }}
                  >
                    <CloseIcon />
                  </IconButton>
                </div>
              )
            })}
          </div>
          <div className={classes.prefixIdField}>
            <TextField
              value={referenceInfo.prefix}
              onChange={event => {
                setReferenceInfo({
                  ...referenceInfo,
                  prefix: event.target.value,
                })
              }}
              label="Reference"
              autoComplete="off"
              placeholder="Prefix"
            />
            <TextField
              value={referenceInfo.id}
              onChange={event => {
                setReferenceInfo({ ...referenceInfo, id: event.target.value })
              }}
              label="Reference Id"
              autoComplete="off"
              placeholder="id"
            />
          </div>
          <TextField
            value={noteString}
            onChange={event => {
              setNoteString(event.target.value)
            }}
            label="Note"
            autoComplete="off"
          />
          <Button
            color="primary"
            variant="contained"
            style={{ marginTop: 20 }}
            onClick={() => {
              if (noteString !== '') {
                noteArray.length > 0
                  ? setNoteArray([...noteArray, noteString])
                  : setNoteArray([noteString])
              }
            }}
          >
            Add
          </Button>
          {noteArray.map(value => {
            return (
              <div key={value}>
                {value}
                <IconButton
                  aria-label="close"
                  onClick={() => {
                    setNoteArray(noteArray.filter(note => note !== value))
                  }}
                >
                  <CloseIcon />
                </IconButton>
              </div>
            )
          })}
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
                field: provenanceFormInfo.field,
                evidenceCode: provenanceFormInfo.evidence.id,
                evidenceCodeLabel: provenanceFormInfo.evidence.code
                  ? `${provenanceFormInfo.evidence.code} (${provenanceFormInfo.evidence.id}): ${provenanceFormInfo.evidence.label}`
                  : `${provenanceFormInfo.evidence.label} (${provenanceFormInfo.evidence.id})`,
                withOrFrom: withArray,
                reference: `${referenceInfo.prefix}:${referenceInfo.id}`,
                id: loadData.selectedAnnotation?.id || null,
                notes: noteArray,
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
              field: provenanceFormInfo.field,
              evidenceCode: provenanceFormInfo.evidence.id,
              evidenceCodeLabel: provenanceFormInfo.evidence.code
                ? `${provenanceFormInfo.evidence.code} (${provenanceFormInfo.evidence.id}): ${provenanceFormInfo.evidence.label}`
                : `${provenanceFormInfo.evidence.label} (${provenanceFormInfo.evidence.id})`,
              withOrFrom: withArray,
              reference: `${referenceInfo.prefix}:${referenceInfo.id}`,
              notes: noteArray,
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
