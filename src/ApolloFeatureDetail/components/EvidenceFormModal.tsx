import { makeStyles, TextField, Button, IconButton } from '@material-ui/core'
import { Autocomplete } from '@material-ui/lab'
import GOEvidenceCodes from './GOEvidenceCodes'
import React, { useEffect, useState } from 'react'
import CloseIcon from '@material-ui/icons/Close'

interface GoResults {
  id: string
  label: string[]
}

interface EvidenceResults extends GoResults {
  code: string
}

const useStyles = makeStyles(theme => ({
  prefixIdField: {
    '& .MuiTextField-root': {
      marginRight: theme.spacing(1),
    },
  },
  errorText: {
    color: theme.palette.error.main,
  },
}))
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

export default function EvidenceModal({
  evidenceInfo,
  setEvidenceInfo,
  disableCondition = false,
  loadData,
}: {
  evidenceInfo: any
  setEvidenceInfo: (data: any) => void
  disableCondition: boolean
  loadData: any
}) {
  const [evidenceAutocomplete, setEvidenceAutocomplete] = useState<
    EvidenceResults[]
  >([])
  const classes = useStyles()
  const initialPrefixId = { prefix: '', id: '' }
  const [withInfo, setWithInfo] = useState(initialPrefixId)
  const [noteString, setNoteString] = useState('')

  useEffect(() => {
    if (Object.keys(loadData).length) {
      const infoToLoad = loadData.selectedAnnotation

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
  }, [loadData, setEvidenceInfo])

  useEffect(() => {
    setEvidenceInfo(evidenceInfo)
  }, [evidenceInfo, setEvidenceInfo])
  return (
    <div>
      <Autocomplete
        id="evidence-autocomplete"
        freeSolo
        options={evidenceAutocomplete}
        value={evidenceInfo.evidence.id}
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
        disabled={disableCondition}
        onChange={(event, value, reason) => {
          if (reason === 'clear') {
            setEvidenceInfo({
              ...evidenceInfo,
              evidence: {
                label: '',
                id: '',
                code: '',
              },
            })
          }
          if (value) {
            setEvidenceInfo({
              ...evidenceInfo,
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
            onChange={async event => {
              setEvidenceInfo({
                ...evidenceInfo,
                evidence: {
                  label: '',
                  code: '',
                  id: event.target.value,
                },
              })

              if (evidenceInfo.allECOEvidence) {
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
            disabled={disableCondition}
            style={{ width: '70%' }}
            helperText={
              <>
                {evidenceInfo.evidence.label && evidenceInfo.evidence.id && (
                  <a
                    href={`https://evidenceontology.org/term/${evidenceInfo.evidence.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {evidenceInfo.evidence.label} ({evidenceInfo.evidence.id})
                  </a>
                )}
                {evidenceInfo.evidence.label && evidenceInfo.evidence.id && (
                  <br />
                )}
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
        checked={evidenceInfo.allECOEvidence}
        onChange={event => {
          setEvidenceInfo({
            ...evidenceInfo,
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
          disabled={disableCondition}
          placeholder="Prefix"
        />
        <TextField
          value={withInfo.id}
          onChange={event => {
            setWithInfo({ ...withInfo, id: event.target.value })
          }}
          label="With Id"
          autoComplete="off"
          disabled={disableCondition}
          placeholder="id"
        />
        <Button
          color="primary"
          variant="contained"
          style={{ marginTop: 20 }}
          onClick={() => {
            if (withInfo !== initialPrefixId) {
              const prefixIdString = `${withInfo.prefix}:${withInfo.id}`
              setEvidenceInfo({
                ...evidenceInfo,
                withArray: [...evidenceInfo.withArray, prefixIdString],
              })
              setWithInfo(initialPrefixId)
            }
          }}
        >
          Add
        </Button>
        {evidenceInfo.withArray.map((value: string) => {
          return (
            <div key={value}>
              {value}
              <IconButton
                aria-label="close"
                onClick={() => {
                  setEvidenceInfo({
                    ...evidenceInfo,
                    withArray: evidenceInfo.withArray.filter(
                      (withString: string) => withString !== value,
                    ),
                  })
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
          value={evidenceInfo.referenceInfo.prefix}
          onChange={event => {
            setEvidenceInfo({
              ...evidenceInfo,
              referenceInfo: {
                ...evidenceInfo.referenceInfo,
                prefix: event.target.value,
              },
            })
          }}
          label="Reference"
          autoComplete="off"
          disabled={disableCondition}
          placeholder="Prefix"
        />
        <TextField
          value={evidenceInfo.referenceInfo.id}
          onChange={event => {
            setEvidenceInfo({
              ...evidenceInfo,
              referenceInfo: {
                ...evidenceInfo.referenceInfo,
                id: event.target.value,
              },
            })
          }}
          label="Reference Id"
          autoComplete="off"
          disabled={disableCondition}
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
        disabled={disableCondition}
      />
      <Button
        color="primary"
        variant="contained"
        style={{ marginTop: 20 }}
        onClick={() => {
          if (noteString !== '') {
            setEvidenceInfo({
              ...evidenceInfo,
              noteArray: [...evidenceInfo.noteArray, noteString],
            })
          }
        }}
      >
        Add
      </Button>
      {evidenceInfo.noteArray.map((value: string) => {
        return (
          <div key={value}>
            {value}
            <IconButton
              aria-label="close"
              onClick={() => {
                setEvidenceInfo({
                  ...evidenceInfo,
                  noteArray: evidenceInfo.noteArray.filter(
                    (note: string) => note !== value,
                  ),
                })
              }}
            >
              <CloseIcon />
            </IconButton>
          </div>
        )
      })}
    </div>
  )
}
