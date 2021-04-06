import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  makeStyles,
  TextField,
  MenuItem,
  Button,
  IconButton,
  Typography,
} from '@material-ui/core'
import { Autocomplete } from '@material-ui/lab'
import WarningIcon from '@material-ui/icons/Warning'
import CloseIcon from '@material-ui/icons/Close'
import { ApolloFeature } from '../ApolloFeatureDetail'

interface GoResults {
  match: string
  id: string
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
}))

interface RelationObject {
  prefix: string
  id: string
}

const fetchGOTermResults = async (aspect: string, currentText: string) => {
  // https://api.geneontology.org/api/search/entity/autocomplete/lactas?rows=40&prefix=GO&category=biological%20process
  // https://api.geneontology.org/api/search/entity/autocomplete/A?rows=40&prefix=GO&category=biological%20process
  const data = {
    rows: 40,
    prefix: 'GO',
    category: aspect,
  }

  let params = Object.entries(data)
    .map(([key, val]) => `${key}=${encodeURIComponent(val)}`)
    .join('&')

  console.log(params)
  const response = await fetch(
    `https://api.geneontology.org/api/search/entity/autocomplete/${currentText}?${params}`,
    {
      method: 'GET',
    },
  )

  const results = await response.json()
  return results
}

function GoModalError({
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
        Invalid Go Annotation
        <IconButton
          aria-label="close"
          className={classes.closeButton}
          onClick={handleClose}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <DialogContentText>Reasons:</DialogContentText>
        {errorMessageArray.map(reason => (
          <DialogContentText key={reason}>{reason}</DialogContentText>
        ))}
      </DialogContent>
      <Button
        className={classes.buttons}
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
export default function GoModal({
  handleClose,
  model,
  clickedFeature,
  data = {},
}: {
  handleClose: () => void
  model: any
  clickedFeature: ApolloFeature
  data: any
}) {
  const classes = useStyles()
  const [aspect, setAspect] = useState('')
  const [goFormInfo, setGoFormInfo] = useState({
    goTerm: { match: '', id: '' },
    relationship: '',
    not: false,
    evidence: '',
    allECOEvidence: false,
  })
  const [goTermAutocomplete, setGoTermAutocomplete] = useState<GoResults[]>([])

  const initialWith = { prefix: '', id: '' }
  const [withInfo, setWithInfo] = useState(initialWith)
  const [withArray, setWithArray] = useState<string[]>([])
  const [referenceInfo, setReferenceInfo] = useState({ prefix: '', id: '' })
  const [noteString, setNoteString] = useState('')
  const [noteArray, setNoteArray] = useState<string[]>([])

  const [openErrorModal, setOpenErrorModal] = useState(false)

  const relationValueText = [
    {
      selectedAspect: 'biological process',
      choices: [
        { text: 'involved in', value: 'RO:0002331' },
        { text: 'acts upstream of', value: 'RO:0002263' },
        { text: 'acts upstream of positive effect', value: 'RO:0004034' },
        { text: 'acts upstream of negative effect', value: 'RO:0004035' },
        { text: 'acts upstream of or within', value: 'RO:0002264' },
        {
          text: 'acts upstream of or within positive effect',
          value: 'RO:0004032',
        },
        {
          text: 'acts upstream of or within negative effect',
          value: 'RO:0004033',
        },
      ],
    },
    {
      selectedAspect: 'molecular function',
      choices: [
        { text: 'enables', value: 'RO:0002327' },
        { text: 'contributes to', value: 'RO:0002326' },
      ],
    },
    {
      selectedAspect: 'cellular component',
      choices: [
        { text: 'part of', value: 'BFO:0000050' },
        { text: 'colocalizes with', value: 'RO:0002325' },
        { text: 'is active in', value: 'RO:0002432' },
      ],
    },
  ]

  const formValidation = () => {
    const errorMessageArray = []
    if (!goFormInfo.goTerm) {
      errorMessageArray.push('You must provide a GO term')
    } else if (!goFormInfo.goTerm.id.includes(':')) {
      errorMessageArray.push(
        'You must provide a prefix and suffix for the GO term',
      )
    }

    if (!goFormInfo.evidence) {
      errorMessageArray.push('You must provide an ECO term')
    } else if (
      !goFormInfo.evidence.includes(':') &&
      !goFormInfo.allECOEvidence
    ) {
      errorMessageArray.push(
        'You must provide a prefix and suffix for the ECO term',
      )
    }

    if (!goFormInfo.relationship) {
      errorMessageArray.push('You must provide a Gene Relationship')
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

  // go term hits an api and returns suggestions, make sure to do that
  // https://api.geneontology.org/api/search/entity/autocomplete/lactas?rows=40&prefix=GO&category=biological%20process

  return (
    <Dialog
      open
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
      data-testid="go-editing-modal"
      fullWidth={true}
    >
      <DialogTitle id="alert-dialog-title">
        Add new Go Annotations to {clickedFeature.name}
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
            <a
              href="http://geneontology.org/docs/go-annotations/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Go Annotation Guidance
            </a>
          </DialogContentText>
        </DialogContent>
      </div>
      <div className={classes.root}>
        <form>
          <TextField
            select
            label="Aspect"
            value={aspect}
            onChange={event => {
              setAspect(event.target.value)
            }}
            style={{ width: '30%', marginRight: 10 }}
            helperText={aspect || ''}
          >
            <MenuItem value="" />
            <MenuItem value="biological process">BP</MenuItem>
            <MenuItem value="molecular function">MF</MenuItem>
            <MenuItem value="cellular component">CC</MenuItem>
          </TextField>
          {/* TODO: hit the autocomplete api to fill out the terms while they search this textfield*/}
          <Autocomplete
            id="goTerm-autocomplete"
            freeSolo
            options={goTermAutocomplete}
            getOptionLabel={option => `${option.match} (${option.id})`}
            onChange={(event, value) => {
              if (value) {
                setGoFormInfo({
                  ...goFormInfo,
                  goTerm: value as GoResults,
                })
              }
            }}
            selectOnFocus
            renderInput={params => (
              <TextField
                {...params}
                value={goFormInfo.goTerm}
                onChange={async event => {
                  setGoFormInfo({
                    ...goFormInfo,
                    goTerm: {
                      match: '',
                      id: event.target.value,
                    },
                  })
                  const result = await fetchGOTermResults(
                    aspect,
                    event.target.value,
                  )
                  setGoTermAutocomplete(result.docs)
                }}
                label="Go term"
                autoComplete="off"
                disabled={!aspect}
                style={{ width: '60%' }}
                helperText={
                  goFormInfo.goTerm.match &&
                  goFormInfo.goTerm.id && (
                    <a
                      href={`http://amigo.geneontology.org/amigo/term/${goFormInfo.goTerm.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {goFormInfo.goTerm.match} ({goFormInfo.goTerm.id})
                    </a>
                  )
                }
              />
            )}
          />
          <br />
          {/* ask about clearing this field when switching aspects */}
          <TextField
            select
            label="Relationship between Gene Product and GO Term"
            value={goFormInfo.relationship}
            onChange={event => {
              setGoFormInfo({
                ...goFormInfo,
                relationship: event.target.value,
              })
            }}
            style={{ width: '70%' }}
            disabled={!aspect}
            helperText={
              goFormInfo.relationship && (
                <a
                  href={`http://www.ontobee.org/ontology/RO?iri=http://purl.obolibrary.org/obo/${goFormInfo.relationship.replace(
                    ':',
                    '_',
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {goFormInfo.relationship}
                </a>
              )
            }
          >
            <MenuItem value="" />
            {relationValueText
              .find(obj => obj.selectedAspect === aspect)
              ?.choices.map(choice => (
                <MenuItem key={choice.value} value={choice.value}>
                  {choice.text}
                </MenuItem>
              ))}
          </TextField>
          <input
            id="not"
            type="checkbox"
            checked={goFormInfo.not}
            onChange={event => {
              setGoFormInfo({ ...goFormInfo, not: event.target.checked })
            }}
            style={{ marginTop: 40 }}
          />
          <label htmlFor="not">Not</label>
          <TextField
            value={goFormInfo.evidence}
            onChange={event => {
              setGoFormInfo({ ...goFormInfo, evidence: event.target.value })
            }}
            label="Evidence"
            autoComplete="off"
            disabled={!aspect}
            style={{ width: '70%' }}
            helperText={
              <a
                href="http://geneontology.org/docs/guide-go-evidence-codes/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Evidence Code Info
              </a>
            }
          />
          <input
            id="allECOEvidence"
            type="checkbox"
            checked={goFormInfo.allECOEvidence}
            onChange={event => {
              setGoFormInfo({
                ...goFormInfo,
                allECOEvidence: event.target.checked,
              })
            }}
            style={{ marginTop: 40, marginRight: 10 }}
          />
          <label htmlFor="allECOEvidence">All ECO Evidence</label>
          <br />
          {/* have one field instead of two, placeholder is prefix:id, check for colon*/}
          <div className={classes.prefixIdField}>
            <TextField
              value={withInfo.prefix}
              onChange={event => {
                setWithInfo({ ...withInfo, prefix: event.target.value })
              }}
              label="With"
              autoComplete="off"
              disabled={!aspect}
              placeholder="Prefix"
            />
            <TextField
              value={withInfo.id}
              onChange={event => {
                setWithInfo({ ...withInfo, id: event.target.value })
              }}
              label="With Id"
              autoComplete="off"
              disabled={!aspect}
              placeholder="id"
            />
            <Button
              color="primary"
              variant="contained"
              style={{ marginTop: 20 }}
              onClick={() => {
                if (withInfo !== initialWith) {
                  const prefixIdString = `${withInfo.prefix}:${withInfo.id}`
                  withArray.length > 0
                    ? setWithArray([...withArray, prefixIdString])
                    : setWithArray([prefixIdString])
                  setWithInfo(initialWith)
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
              disabled={!aspect}
              placeholder="Prefix"
            />
            <TextField
              value={referenceInfo.id}
              onChange={event => {
                setReferenceInfo({ ...referenceInfo, id: event.target.value })
              }}
              label="Reference Id"
              autoComplete="off"
              disabled={!aspect}
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
            disabled={!aspect}
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
                aspect: aspect
                  .match(/\b(\w)/g)
                  ?.join('')
                  .toUpperCase(), // gets acronym of aspect, ex. biological process => BP
                goTerm: goFormInfo.goTerm.id,
                goTermLabel: goFormInfo.goTerm.match,
                geneRelationship: goFormInfo.relationship,
                evidenceCode: `${goFormInfo.allECOEvidence ? 'ECO:' : ''}${
                  goFormInfo.evidence
                }`,
                negate: goFormInfo.not,
                withOrFrom: withArray,
                references: [`${referenceInfo.prefix}:${referenceInfo.id}`],
              }

              //                {
              //                    "annotations":[{
              //                    "geneRelationship":"RO:0002326", "goTerm":"GO:0031084", "references":"[\"ref:12312\"]", "gene":
              //                    "1743ae6c-9a37-4a41-9b54-345065726d5f", "negate":false, "evidenceCode":"ECO:0000205", "withOrFrom":
              //                    "[\"adf:12312\"]"
              //                }]}

              console.log(data)

              const response = await fetch(
                `${model.apolloUrl}/goAnnotation/save`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(data),
                },
              )
              console.log('go', response)
            }
          }}
        >
          Save
        </Button>
        <Button
          variant="contained"
          onClick={() => {
            handleClose()
          }}
        >
          Cancel
        </Button>
      </div>
      {openErrorModal && (
        <GoModalError
          handleClose={() => setOpenErrorModal(false)}
          errorMessageArray={formValidation()}
        />
      )}
    </Dialog>
  )
}
