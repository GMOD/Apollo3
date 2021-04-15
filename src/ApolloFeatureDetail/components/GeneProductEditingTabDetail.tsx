import { Button, makeStyles } from '@material-ui/core'
import { observer } from 'mobx-react'
import React, { useState, useEffect } from 'react'
import { AplInputProps, ApolloFeature } from '../ApolloFeatureDetail'
import GeneProductModal from './GeneProductModal'
import { DataGrid, GridSortDirection } from '@material-ui/data-grid'
import ConfirmDeleteModal from './ConfirmDeleteModal'
import TextImportModal from './TextImportModal'

interface GeneProductAnnotation {
  [key: string]: string
}
const useStyles = makeStyles(theme => ({
  buttons: {
    marginRight: 10,
  },
}))

const GeneProductEditingTabDetail = ({
  clickedFeature,
  props,
}: {
  clickedFeature: ApolloFeature
  props: AplInputProps
}) => {
  const { model } = props
  const classes = useStyles()
  const [geneProductAnnotations, setGeneProductAnnotations] = useState([])
  const [geneProductDialogInfo, setGeneProductDialogInfo] = useState({
    open: false,
    data: {},
  })
  const [openConfirmDeleteModal, setOpenConfirmDeleteModal] = useState(false)
  const [openImportModal, setOpenImportModal] = useState(false)

  const handleClose = () => {
    setGeneProductDialogInfo({ open: false, data: {} })
  }

  useEffect(() => {
    async function fetchGeneProductAnnotations() {
      const data = {
        username: sessionStorage.getItem(`${model.apolloId}-apolloUsername`), // get from renderProps later
        password: sessionStorage.getItem(`${model.apolloId}-apolloPassword`),
        uniqueName: clickedFeature.uniquename,
      }

      const response = await fetch(`${model.apolloUrl}/geneProduct`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })
      const json = await response.json()
      setGeneProductAnnotations(json.annotations || [])
    }
    fetchGeneProductAnnotations()
  }, [clickedFeature.uniquename, model.apolloUrl, model.apolloId])

  const [selectedAnnotation, setSelectedAnnotation] = useState({})

  const columns = [
    { field: 'name', headerName: 'Name' },
    { field: 'evidence', headerName: 'Evidence' },
    { field: 'basedOn', headerName: 'Based On' },
    { field: 'reference', headerName: 'Reference' },
  ]

  const rows = geneProductAnnotations.map(
    (annotation: GeneProductAnnotation, index: number) => ({
      id: index,
      name: `${annotation.productName}`,
      evidence: annotation.evidenceCode,
      basedOn: JSON.parse(annotation.withOrFrom).join('\r\n'),
      reference: annotation.reference,
    }),
  )

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
              setSelectedAnnotation(
                geneProductAnnotations[rowData.row.id as number],
              )
            }}
          />
        </div>
      </div>
      <div style={{ margin: 5 }}>
        <Button
          color="secondary"
          variant="contained"
          className={classes.buttons}
          onClick={async () =>
            setGeneProductDialogInfo({ open: true, data: {} })
          }
        >
          New
        </Button>
        <Button
          color="secondary"
          variant="contained"
          className={classes.buttons}
          disabled={Object.keys(selectedAnnotation).length === 0}
          onClick={async () => {
            setGeneProductDialogInfo({
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
        {geneProductDialogInfo.open && (
          <GeneProductModal
            handleClose={handleClose}
            model={model}
            clickedFeature={clickedFeature}
            loadData={geneProductDialogInfo.data}
          />
        )}
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
              await fetch(`${model.apolloUrl}/geneProduct/delete`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
              })
            }}
            objToDeleteName={`Gene Product Annotation: ${
              (selectedAnnotation as GeneProductAnnotation).productName
            }`}
          />
        )}
        {openImportModal && (
          <TextImportModal
            model={model}
            handleClose={() => {
              setOpenImportModal(false)
            }}
            endpointUrl={`${model.apolloUrl}/geneProduct/save`}
            from="Gene Product"
            helpText={`Format is:
            {
                "feature": "",
                "productName": "",
                "alternate": false,
                "evidenceCode": "",
                "evidenceCodeLabel": "",
                "withOrFrom": [],
                "reference": "",
                "notes": []
            }`}
          />
        )}
      </div>
    </>
  )
}

export default observer(GeneProductEditingTabDetail)
