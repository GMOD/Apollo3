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

interface RelationObject {
  prefix: string
  id: string
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
    goTerm: '',
    relationship: '',
    not: false,
    evidence: '',
    allECOEvidence: false,
  })

  const initialWith = { prefix: '', id: '' }
  const [withInfo, setWithInfo] = useState(initialWith)
  const [referenceInfo, setReferenceInfo] = useState({ prefix: '', id: '' })
  const [noteString, setNoteString] = useState('')
  const [noteArray, setNoteArray] = useState<string[]>([])

  const [withArray, setWithArray] = useState<RelationObject[]>([])

  const relationValueText = [
    {
      selectedAspect: 'BP',
      values: [
        'involved in',
        'acts upstream of',
        'acts upstream of positive effect',
        'acts upstream of negative effect',
        'acts upstream of or within',
        'acts upstream of or within positive effect',
        'acts upstream of or within negative effect',
      ],
    },
    {
      selectedAspect: 'MF',
      values: ['enables', 'contributes to'],
    },
    {
      selectedAspect: 'CC',
      values: ['part of', 'colocalizes with', 'is active in'],
    },
  ]

  // go term hits an api and returns suggestions, make sure to do that
  // https://api.geneontology.org/api/search/entity/autocomplete/lactas?rows=40&prefix=GO&category=biological%20process

  //                {
  //                    "annotations":[{
  //                    "geneRelationship":"RO:0002326", "goTerm":"GO:0031084", "references":"[\"ref:12312\"]", "gene":
  //                    "1743ae6c-9a37-4a41-9b54-345065726d5f", "negate":false, "evidenceCode":"ECO:0000205", "withOrFrom":
  //                    "[\"adf:12312\"]"
  //                }]}

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
            <a href="http://geneontology.org/docs/go-annotations/">
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
          >
            <MenuItem value="" />
            <MenuItem value="BP">BP</MenuItem>
            <MenuItem value="MF">MF</MenuItem>
            <MenuItem value="CC">CC</MenuItem>
          </TextField>
          <TextField
            value={goFormInfo.goTerm}
            onChange={event => {
              setGoFormInfo({ ...goFormInfo, goTerm: event.target.value })
            }}
            label="Go term"
            autoComplete="off"
            disabled={!aspect}
            style={{ width: '40%' }}
          />
          <br />
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
          >
            {relationValueText
              .find(obj => obj.selectedAspect === aspect)
              ?.values.map(value => (
                <MenuItem key={value} value={value}>
                  {value}
                </MenuItem>
              )) || <MenuItem>""</MenuItem>}
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
          {/* <div> {label} <CloseIconButton/></div> */}
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
                  withArray.length > 0
                    ? setWithArray([...withArray, withInfo])
                    : setWithArray([withInfo])
                  setWithInfo(initialWith)
                }
              }}
            >
              Add
            </Button>
            {withArray.map((value: RelationObject) => {
              return (
                <div key={`${value.prefix}-${value.id}`}>
                  {value.prefix} : {value.id}
                  <IconButton
                    aria-label="close"
                    onClick={() => {
                      setWithArray(withArray.filter(obj => obj !== value))
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
            const data = {
              username: sessionStorage.getItem(
                `${model.apolloId}-apolloUsername`,
              ),
              password: sessionStorage.getItem(
                `${model.apolloId}-apolloPassword`,
              ),
              feature: clickedFeature.uniquename,
              aspect,
              goTerm: goFormInfo.goTerm,
              geneRelationship: goFormInfo.relationship,
              evidenceCode: `${goFormInfo.allECOEvidence ? 'ECO:' : ''} ${
                goFormInfo.evidence
              }`,
              negate: goFormInfo.not,
              withOrFrom: withArray,
              references: [referenceInfo],
            }

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
    </Dialog>
  )
}
