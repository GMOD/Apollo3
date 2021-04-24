import { Button, makeStyles } from '@material-ui/core'
import { observer } from 'mobx-react'
import React, { useState, useEffect } from 'react'
import { AplInputProps, ApolloFeature } from '../ApolloFeatureDetail'
import GoModal from './GoModal'
import { DataGrid, GridSortDirection } from '@material-ui/data-grid'
import ConfirmDeleteModal from './ConfirmDeleteModal'
import TextImportModal from './TextImportModal'
import GeneProductModal from './GeneProductModal'
import ProvenanceModal from './ProvenanceModal'

interface Annotation {
  [key: string]: string
}

const useStyles = makeStyles(theme => ({
  buttons: {
    marginRight: 10,
  },
}))

// NOTE: this is a more generic form of tab detail
// instead of having go editing, gene product editing, etc..
// not in use right now, here as a concept
const BaseEditingTabDetail = ({
  clickedFeature,
  props,
  endpoint,
}: {
  clickedFeature: ApolloFeature
  props: AplInputProps
  endpoint: string
}) => {
  const { model } = props
  const classes = useStyles()
  const [annotations, setAnnotations] = useState([])
  const [dialogInfo, setDialogInfo] = useState({ open: false, data: {} })
  const [openConfirmDeleteModal, setOpenConfirmDeleteModal] = useState(false)
  const [openImportModal, setOpenImportModal] = useState(false)
  const [selectedAnnotation, setSelectedAnnotation] = useState({})
  const [uniqueIdentifier, setUniqueIdentifier] = useState('')
  const [helperText, setHelperText] = useState('')

  const handleClose = () => {
    setDialogInfo({ open: false, data: {} })
  }

  // convert the camel case endpoint to sentence
  const name =
    endpoint
      .replace(/([A-Z])/g, ' $1')
      .charAt(0)
      .toUpperCase() + endpoint.replace(/([A-Z])/g, ' $1').slice(1)

  const findModal = () => {
    switch (endpoint) {
      case 'goAnnotation': {
        setHelperText(`Format is:
        {
         "feature": "",
         "aspect": "",
         "goTerm": "",
         "goTermLabel": "",
         "geneRelationship": "",
         "evidenceCode": "",
         "evidenceCodeLabel": "",
         "negate": false,
         "withOrFrom": [],
         "reference": "",
         "notes": []
     }`)
        setUniqueIdentifier((selectedAnnotation as Annotation).goTerm)
        return (
          <GoModal
            handleClose={handleClose}
            model={model}
            clickedFeature={clickedFeature}
            loadData={dialogInfo.data}
          />
        )
      }

      case 'geneProduct': {
        setHelperText(`Format is:
        {
            "feature": "",
            "productName": "",
            "alternate": false,
            "evidenceCode": "",
            "evidenceCodeLabel": "",
            "withOrFrom": [],
            "reference": "",
            "notes": []
        }`)
        setUniqueIdentifier((selectedAnnotation as Annotation).productName)
        return (
          <GeneProductModal
            handleClose={handleClose}
            model={model}
            clickedFeature={clickedFeature}
            loadData={dialogInfo.data}
          />
        )
      }

      case 'provenance': {
        setUniqueIdentifier((selectedAnnotation as Annotation).productName)
        setHelperText(`Format is:
        {
            "feature": "",
            "field": "",
            "evidenceCode": "",
            "evidenceCodeLabel": "",
            "withOrFrom": [],
            "reference": "",
            "notes": []
        }`)
        return (
          <ProvenanceModal
            handleClose={handleClose}
            model={model}
            clickedFeature={clickedFeature}
            loadData={dialogInfo.data}
          />
        )
      }

      default:
        return null
    }
  }

  useEffect(() => {
    async function fetchAnnotations() {
      const data = {
        username: sessionStorage.getItem(`${model.apolloId}-apolloUsername`), // get from renderProps later
        password: sessionStorage.getItem(`${model.apolloId}-apolloPassword`),
        uniqueName: clickedFeature.uniquename,
      }

      const response = await fetch(`${model.apolloUrl}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })
      const json = await response.json()
      setAnnotations(json.annotations || [])
    }
    fetchAnnotations()
  }, [clickedFeature.uniquename, model.apolloUrl, model.apolloId, endpoint])

  useEffect(() => {
    switch (endpoint) {
      case 'goAnnotation': {
        setHelperText(`Format is:
        {
         "feature": "",
         "aspect": "",
         "goTerm": "",
         "goTermLabel": "",
         "geneRelationship": "",
         "evidenceCode": "",
         "evidenceCodeLabel": "",
         "negate": false,
         "withOrFrom": [],
         "reference": "",
         "notes": []
     }`)
        setUniqueIdentifier((selectedAnnotation as Annotation).goTerm)
        break
      }

      case 'geneProduct': {
        setHelperText(`Format is:
        {
            "feature": "",
            "productName": "",
            "alternate": false,
            "evidenceCode": "",
            "evidenceCodeLabel": "",
            "withOrFrom": [],
            "reference": "",
            "notes": []
        }`)
        setUniqueIdentifier((selectedAnnotation as Annotation).productName)
        break
      }

      case 'provenance': {
        setUniqueIdentifier((selectedAnnotation as Annotation).productName)
        setHelperText(`Format is:
        {
            "feature": "",
            "field": "",
            "evidenceCode": "",
            "evidenceCodeLabel": "",
            "withOrFrom": [],
            "reference": "",
            "notes": []
        }`)
      }
    }
  }, [endpoint, selectedAnnotation])

  const columns = [
    { field: 'name', headerName: 'Name' },
    { field: 'evidence', headerName: 'Evidence' },
    { field: 'basedOn', headerName: 'Based On' },
    { field: 'reference', headerName: 'Reference' },
  ]

  const rows = annotations.map((annotation: Annotation, index: number) => ({
    id: index,
    name: `${name}`,
    evidence: annotation.evidenceCode,
    basedOn: JSON.parse(annotation.withOrFrom).join('\r\n'),
    reference: annotation.reference,
  }))

  return (
    <>
      <div style={{ height: 400, width: '100%' }}>
        <div style={{ display: 'flex', height: '100%' }}>
          <DataGrid
            disableColumnMenu
            hideFooterSelectedRowCount
            pageSize={25}
            rows={rows}
            columns={columns}
            sortModel={[
              { field: 'reference', sort: 'asc' as GridSortDirection },
            ]}
            onRowClick={rowData => {
              setSelectedAnnotation(annotations[rowData.row.id as number])
            }}
          />
        </div>
      </div>
      <div style={{ margin: 5 }}>
        <Button
          color="secondary"
          variant="contained"
          className={classes.buttons}
          onClick={async () => setDialogInfo({ open: true, data: {} })}
        >
          New
        </Button>
        <Button
          color="secondary"
          variant="contained"
          className={classes.buttons}
          disabled={Object.keys(selectedAnnotation).length === 0}
          onClick={async () => {
            setDialogInfo({
              open: true,
              data: {
                selectedAnnotation,
              },
            })
          }}
        >
          Edit
        </Button>
        <Button
          color="secondary"
          variant="contained"
          className={classes.buttons}
          disabled={Object.keys(selectedAnnotation).length === 0}
          onClick={() => {
            setOpenConfirmDeleteModal(true)
          }}
        >
          Delete
        </Button>
        <Button
          color="secondary"
          variant="contained"
          className={classes.buttons}
          onClick={() => {
            setOpenImportModal(true)
          }}
        >
          Import From Text
        </Button>
        {dialogInfo.open && findModal()}
        {openConfirmDeleteModal && (
          <ConfirmDeleteModal
            handleClose={() => setOpenConfirmDeleteModal(false)}
            deleteFunc={async () => {
              const data = {
                username: sessionStorage.getItem(
                  `${model.apolloId}-apolloUsername`,
                ),
                password: sessionStorage.getItem(
                  `${model.apolloId}-apolloPassword`,
                ),
                ...selectedAnnotation,
              }
              const response = await fetch(
                `${model.apolloUrl}/${endpoint}/delete`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(data),
                },
              )
            }}
            objToDeleteName={`${name}: ${uniqueIdentifier}`}
          />
        )}
        {openImportModal && (
          <TextImportModal
            model={model}
            handleClose={() => {
              setOpenImportModal(false)
            }}
            endpointUrl={`${model.apolloUrl}/${endpoint}/save`}
            from={name}
            helpText={helperText}
          />
        )}
      </div>
    </>
  )
}

export default observer(BaseEditingTabDetail)
