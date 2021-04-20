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
  Typography,
} from '@material-ui/core'
import CloseIcon from '@material-ui/icons/Close'
import { ApolloFeature } from '../ApolloFeatureDetail'
import copy from 'copy-to-clipboard'

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

// error if form filled out incorrectly, tells user why
function DbXrefPMIDConfirm({
  handleClose,
  confirm,
  cancel,
  articleToConfirm,
}: {
  handleClose: () => void
  confirm: () => void
  cancel: () => void
  articleToConfirm: string
}) {
  const classes = useStyles()

  return (
    <Dialog
      open
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-description"
      data-testid="dbxref-pmid-confirm"
      fullWidth={true}
      style={{ zIndex: 2000 }}
    >
      <DialogTitle id="alert-dialog-title">
        Add Article
        <IconButton
          aria-label="close"
          className={classes.closeButton}
          onClick={handleClose}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <DialogContentText>{articleToConfirm}</DialogContentText>
      </DialogContent>
      <div className={classes.buttons}>
        <Button
          variant="contained"
          onClick={() => {
            cancel()
            handleClose()
          }}
        >
          Cancel
        </Button>
        <Button
          color="primary"
          variant="contained"
          onClick={() => {
            confirm()
            handleClose()
          }}
        >
          Ok
        </Button>
      </div>
    </Dialog>
  )
}

export default function DbXrefModal({
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
  const [mode, setMode] = useState('PrefixAccession')
  const [dbPrefixAccession, setDbPrefixAccession] = useState({
    prefix: '',
    accession: '',
  })
  const [PMIDInfo, setPMIDInfo] = useState({ PMID: '', article: '', url: '' })
  const [articleToConfirm, setArticleToConfirm] = useState('')
  const [showPMIDConfirm, setShowPMIDConfirm] = useState(false)
  const [loading, setLoading] = useState(false)

  const clearForm = () => {
    setDbPrefixAccession({ prefix: '', accession: '' })
    setPMIDInfo({ PMID: '', article: '', url: '' })
  }

  // http://demo.genomearchitect.org/Apollo2/ncbiProxyService?db=pubmed&operation=fetch&id=123
  const fetchPMID = async (currentText: string) => {
    const data = {
      id: currentText,
      db: 'pubmed',
      operation: 'fetch',
    }

    let params = Object.entries(data)
      .map(([key, val]) => `${key}=${encodeURIComponent(val)}`)
      .join('&')

    const response = await fetch(
      `${model.apolloUrl}/ncbiProxyService?${params}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )

    const results = await response.json()
    return results
  }

  // loads annotation if selected in datagrid and edit clicked
  useEffect(() => {
    if (Object.keys(loadData).length) {
      const infoToLoad = loadData.selectedAnnotation
      if (infoToLoad.tag === 'PMID') {
        setPMIDInfo({
          PMID: infoToLoad.value,
          article: 'Loaded from selection',
          url: '',
        })
        setMode('PMID')
      } else {
        setDbPrefixAccession({
          prefix: infoToLoad.tag || '',
          accession: infoToLoad.value || '',
        })
      }
    }
  }, [loadData])

  return (
    <Dialog
      open
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
      data-testid="dbxref-editing-modal"
      fullWidth={true}
    >
      <DialogTitle id="alert-dialog-title">
        Add DbXref to {clickedFeature.name}
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
            select
            label="Mode"
            value={mode}
            onChange={event => {
              setMode(event.target.value)
              clearForm()
            }}
            style={{ width: '30%', marginRight: 10 }}
          >
            <MenuItem value="PrefixAccession">Db Xref</MenuItem>
            <MenuItem value="PMID">PMID</MenuItem>
          </TextField>
          {mode === 'PrefixAccession' ? (
            <div style={{ marginRight: 20 }}>
              <TextField
                label="Prefix"
                onChange={event => {
                  setDbPrefixAccession({
                    ...dbPrefixAccession,
                    prefix: event.target.value,
                  })
                }}
                value={dbPrefixAccession.prefix}
                autoComplete="off"
              />{' '}
              <TextField
                label="Accession"
                onChange={event => {
                  setDbPrefixAccession({
                    ...dbPrefixAccession,
                    accession: event.target.value,
                  })
                }}
                value={dbPrefixAccession.accession}
                autoComplete="off"
              />
            </div>
          ) : (
            <div style={{ marginRight: 20 }}>
              <TextField
                label="PMID"
                onChange={event => {
                  setPMIDInfo({ ...PMIDInfo, PMID: event.target.value })
                }}
                value={PMIDInfo.PMID}
                autoComplete="off"
              />
              <Button
                color="primary"
                variant="contained"
                style={{ marginTop: 20, marginRight: 20 }}
                disabled={loading}
                onClick={async () => {
                  setLoading(true)
                  const result = await fetchPMID(PMIDInfo.PMID)
                  if (result) {
                    setArticleToConfirm(
                      result.PubmedArticleSet.PubmedArticle.MedlineCitation
                        .Article.ArticleTitle,
                    )
                    setLoading(false)
                    setShowPMIDConfirm(true)
                  }
                }}
              >
                {!loading ? 'Search' : 'Searching...'}
              </Button>
              <TextField
                label="Article"
                value={PMIDInfo.article}
                autoComplete="off"
                disabled
                placeholder="Search a valid PMID"
              />
              <Typography>Or</Typography>
              <TextField
                label="PubMed URL"
                onChange={event => {
                  let pmUrl
                  try {
                    pmUrl = new URL(event.target.value)
                  } catch (err) {
                    return
                  }
                  if (pmUrl.hostname === 'pubmed.ncbi.nlm.nih.gov') {
                    const urlPMID = pmUrl.pathname.replaceAll('/', '')
                    setPMIDInfo({
                      ...PMIDInfo,
                      PMID: urlPMID,
                      url: event.target.value,
                    })
                  }
                }}
                value={PMIDInfo.url}
                autoComplete="off"
              />
            </div>
          )}
        </form>
      </div>
      <div className={classes.buttons}>
        <Button
          color="primary"
          variant="contained"
          style={{ marginRight: 5 }}
          disabled={mode === 'PMID' && !PMIDInfo.article && !PMIDInfo.url} // can't save without confirmed pmid
          onClick={async () => {
            const updating = !!Object.keys(loadData).length
            const dbxrefs =
              mode === 'PrefixAccession'
                ? [
                    {
                      db: dbPrefixAccession.prefix,
                      accession: dbPrefixAccession.accession,
                    },
                  ]
                : [{ db: 'PMID', accession: PMIDInfo.PMID }]
            const data = !updating
              ? {
                  username: sessionStorage.getItem(
                    `${model.apolloId}-apolloUsername`,
                  ),
                  password: sessionStorage.getItem(
                    `${model.apolloId}-apolloPassword`,
                  ),
                  sequence: clickedFeature.sequence,
                  organism: 'Fictitious',
                  features: [
                    {
                      uniquename: clickedFeature.uniquename,
                      dbxrefs: dbxrefs,
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
                  sequence: clickedFeature.sequence,
                  organism: 'Fictitious',
                  features: [
                    {
                      uniquename: clickedFeature.uniquename,
                      old_dbxrefs: [
                        {
                          db: loadData.selectedAnnotation.prefix,
                          accession: loadData.selectedAnnotation.accession,
                        },
                      ],
                      new_dbxrefs: dbxrefs,
                    },
                  ],
                }

            const endpointUrl = updating
              ? `${model.apolloUrl}/annotationEditor/updateDbxref`
              : `${model.apolloUrl}/annotationEditor/addDbxref`
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
        <Button
          color="primary"
          variant="contained"
          onClick={() => {
            const dbxrefs =
              mode === 'PrefixAccession'
                ? [
                    {
                      db: dbPrefixAccession.prefix,
                      accession: dbPrefixAccession.accession,
                    },
                  ]
                : [{ db: 'PMID', accession: PMIDInfo.PMID }]
            const dbXrefString = {
              sequence: clickedFeature.sequence,
              organism: 'Fictitious',
              features: [
                {
                  uniquename: clickedFeature.uniquename,
                  dbxrefs: dbxrefs,
                },
              ],
            }
            copy(JSON.stringify(dbXrefString, null, 4))
          }}
        >
          Copy JSON to Clipboard
        </Button>
      </div>
      {showPMIDConfirm && (
        <DbXrefPMIDConfirm
          handleClose={() => setShowPMIDConfirm(false)}
          confirm={() =>
            setPMIDInfo({ ...PMIDInfo, article: articleToConfirm })
          }
          cancel={() => setPMIDInfo({ PMID: '', article: '', url: '' })}
          articleToConfirm={articleToConfirm}
        />
      )}
    </Dialog>
  )
}
