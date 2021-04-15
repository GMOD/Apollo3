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

export default function AttributeModal({
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
  const [prefixAccession, setPrefixAccession] = useState({
    prefix: '',
    accession: '',
  })

  // loads annotation if selected in datagrid and edit clicked
  useEffect(() => {
    if (Object.keys(loadData).length) {
      const infoToLoad = loadData.selectedAnnotation
      setPrefixAccession({
        prefix: infoToLoad.tag || '',
        accession: infoToLoad.value || '',
      })
    }
  }, [loadData])

  return (
    <Dialog
      open
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
      data-testid="attribute-editing-modal"
      fullWidth={true}
    >
      <DialogTitle id="alert-dialog-title">
        Add Attribute to {clickedFeature.name}
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
            <TextField
              label="Prefix"
              onChange={event => {
                setPrefixAccession({
                  ...prefixAccession,
                  prefix: event.target.value,
                })
              }}
              value={prefixAccession.prefix}
              autoComplete="off"
            />{' '}
            <TextField
              label="Accession"
              onChange={event => {
                setPrefixAccession({
                  ...prefixAccession,
                  accession: event.target.value,
                })
              }}
              value={prefixAccession.accession}
              autoComplete="off"
            />
          </div>
        </form>
      </div>
      <div className={classes.buttons}>
        <Button
          color="primary"
          variant="contained"
          style={{ marginRight: 5 }}
          onClick={async () => {
            const updating = !!Object.keys(loadData).length
            const data = !updating
              ? {
                  username: sessionStorage.getItem(
                    `${model.apolloId}-apolloUsername`,
                  ),
                  password: sessionStorage.getItem(
                    `${model.apolloId}-apolloPassword`,
                  ),
                  sequence: clickedFeature.sequence,
                  organism: 'Ficticious',
                  features: [
                    {
                      uniquename: clickedFeature.uniquename,
                      non_reserved_properties: [
                        {
                          db: prefixAccession.prefix,
                          accession: prefixAccession.accession,
                        },
                      ],
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
                  organism: 'Ficticious',
                  features: [
                    {
                      uniquename: clickedFeature.uniquename,
                      old_non_reserved_properties: [
                        {
                          db: loadData.selectedAnnotation.prefix,
                          accession: loadData.selectedAnnotation.accession,
                        },
                      ],
                      new_non_reserved_properties: [
                        {
                          db: prefixAccession.prefix,
                          accession: prefixAccession.accession,
                        },
                      ],
                    },
                  ],
                }

            const endpointUrl = updating
              ? `${model.apolloUrl}/annotationEditor/updateAttribute`
              : `${model.apolloUrl}/annotationEditor/addAttribute`
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
            const attributeString = {
              sequence: clickedFeature.sequence,
              organism: 'Ficticious',
              features: [
                {
                  uniquename: clickedFeature.uniquename,
                  non_reserved_properties: [
                    {
                      db: prefixAccession.prefix,
                      accession: prefixAccession.accession,
                    },
                  ],
                },
              ],
            }
            copy(JSON.stringify(attributeString, null, 4))
          }}
        >
          Copy JSON to Clipboard
        </Button>
      </div>
    </Dialog>
  )
}
