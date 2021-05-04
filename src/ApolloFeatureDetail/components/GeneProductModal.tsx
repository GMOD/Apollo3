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
} from '@material-ui/core'
import { Autocomplete } from '@material-ui/lab'
import WarningIcon from '@material-ui/icons/Warning'
import CloseIcon from '@material-ui/icons/Close'
import { ApolloFeature } from '../ApolloFeatureDetail'
import copy from 'copy-to-clipboard'
import EvidenceFormModal from './EvidenceFormModal'

interface GeneProductResults {
  [key: string]: string
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

// search returns a login form right now
const searchGeneProduct = async (currentText: string, model: any) => {
  const data = {
    username: sessionStorage.getItem(`${model.apolloId}-apolloUsername`) || '',
    password: sessionStorage.getItem(`${model.apolloId}-apolloPassword`) || '',
    organism: 'Fictitious',
    query: currentText,
  }

  const response = await fetch(`${model.apolloUrl}/geneProduct/search/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })
  console.log(response)

  const results = await response.json()
  console.log(results)
  return results
}

// error if form filled out incorrectly, tells user why
function GeneProductModalError({
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
      data-testid="gene-product-editing-modal-error"
      fullWidth={true}
      style={{ zIndex: 2000 }}
    >
      <DialogTitle id="alert-dialog-title">
        <IconButton>
          <WarningIcon />
        </IconButton>
        Invalid Gene Product
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

export default function GeneProductModal({
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
  const [geneProductFormInfo, setGeneProductFormInfo] = useState({
    productName: '',
    alternate: false,
  })
  const [geneProductAutocomplete, setGeneProductAutocomplete] = useState<
    GeneProductResults[]
  >([]) // will need a type later
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
    if (!geneProductFormInfo.productName) {
      errorMessageArray.push('You must provide a Gene Product name')
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
    if (!evidenceInfo.referenceInfo.prefix || !evidenceInfo.referenceInfo.id) {
      errorMessageArray.push(
        'You must provide atleast one reference prefix and id',
      )
    }
    if (evidenceInfo.withArray.length <= 0) {
      errorMessageArray.push(
        'You must provide at least 1 with for the evidence code',
      )
    }
    return errorMessageArray
  }

  // loads annotation if selected in datagrid and edit clicked
  useEffect(() => {
    if (Object.keys(loadData).length) {
      const infoToLoad = loadData.selectedAnnotation
      setGeneProductFormInfo({
        productName: infoToLoad.productName || '',
        alternate: infoToLoad.alternate,
      })
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
      data-testid="gene-product-editing-modal"
      fullWidth={true}
    >
      <DialogTitle id="alert-dialog-title">
        Add new Gene Product to {clickedFeature.name}
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
              GO Annotation Guidance
            </a>
          </DialogContentText>
        </DialogContent>
      </div>
      <div className={classes.root}>
        <form>
          <Autocomplete
            id="geneProduct-autocomplete"
            freeSolo
            options={geneProductAutocomplete}
            value={geneProductFormInfo.productName}
            getOptionLabel={option => {
              if (typeof option === 'string') {
                return option
              }
              if (option) {
                return `${option}`
              }
              return option
            }}
            onChange={(event, value, reason) => {
              if (reason === 'clear') {
                setGeneProductFormInfo({
                  ...geneProductFormInfo,
                  productName: '',
                })
              }
              if (value) {
                setGeneProductFormInfo({
                  ...geneProductFormInfo,
                  productName: (value as GeneProductResults).productName,
                })
              }
            }}
            selectOnFocus
            renderInput={params => (
              <TextField
                {...params}
                onChange={async event => {
                  setGeneProductFormInfo({
                    ...geneProductFormInfo,
                    productName: event.target.value,
                  })

                  const result = await searchGeneProduct(
                    event.target.value,
                    model,
                  )
                  setGeneProductAutocomplete(result)
                }}
                label="Product"
                autoComplete="off"
                style={{ width: '60%' }}
              />
            )}
          />
          <br />
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
                productName: geneProductFormInfo.productName,
                alternate: geneProductFormInfo.alternate,
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
                ? `${model.apolloUrl}/geneProduct/update`
                : `${model.apolloUrl}/geneProduct/save`
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
            const geneProductString = {
              feature: clickedFeature.uniquename,
              productName: geneProductFormInfo.productName,
              alternate: geneProductFormInfo.alternate,
              evidenceCode: evidenceInfo.evidence.id,
              evidenceCodeLabel: evidenceInfo.evidence.code
                ? `${evidenceInfo.evidence.code} (${evidenceInfo.evidence.id}): ${evidenceInfo.evidence.label}`
                : `${evidenceInfo.evidence.label} (${evidenceInfo.evidence.id})`,
              withOrFrom: evidenceInfo.withArray,
              reference: `${evidenceInfo.referenceInfo.prefix}:${evidenceInfo.referenceInfo.id}`,
              notes: evidenceInfo.noteArray,
            }
            copy(JSON.stringify(geneProductString, null, 4))
          }}
        >
          Copy JSON to Clipboard
        </Button>
      </div>
      {openErrorModal && (
        <GeneProductModalError
          handleClose={() => setOpenErrorModal(false)}
          errorMessageArray={formValidation()}
        />
      )}
    </Dialog>
  )
}
