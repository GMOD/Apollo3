import { Button, makeStyles } from '@material-ui/core'
import { observer } from 'mobx-react'
import React, { useState, useEffect } from 'react'
import { AplInputProps, ApolloFeature } from '../ApolloFeatureDetail'
import ProvenanceModal from './ProvenanceModal'
import { DataGrid, GridSortDirection } from '@material-ui/data-grid'
import ConfirmDeleteModal from './ConfirmDeleteModal'
import TextImportModal from './TextImportModal'

interface ProvenanceAnnotation {
  [key: string]: string
}
const useStyles = makeStyles(() => ({
  buttons: {
    marginRight: 10,
  },
}))

const ProvenanceEditingTabDetail = ({
  clickedFeature,
  props,
}: {
  clickedFeature: ApolloFeature
  props: AplInputProps
}) => {
  const { model } = props
  const classes = useStyles()
  const [provenanceAnnotations, setProvenanceAnnotations] = useState([])
  const [provenanceDialogInfo, setProvenanceDialogInfo] = useState({
    open: false,
    data: {},
  })
  const [openConfirmDeleteModal, setOpenConfirmDeleteModal] = useState(false)
  const [openImportModal, setOpenImportModal] = useState(false)

  const handleClose = () => {
    setProvenanceDialogInfo({ open: false, data: {} })
  }

  useEffect(() => {
    async function fetchProvenanceAnnotations() {
      const data = {
        username: sessionStorage.getItem(`${model.apolloId}-apolloUsername`), // get from renderProps later
        password: sessionStorage.getItem(`${model.apolloId}-apolloPassword`),
        uniqueName: clickedFeature.uniquename,
      }

      const response = await fetch(`${model.apolloUrl}/provenance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })
      const json = await response.json()
      setProvenanceAnnotations(json.annotations || [])
    }
    fetchProvenanceAnnotations()
  }, [clickedFeature.uniquename, model.apolloUrl, model.apolloId])

  const [selectedAnnotation, setSelectedAnnotation] = useState({})

  const columns = [
    { field: 'field', headerName: 'Field' },
    { field: 'evidence', headerName: 'Evidence' },
    { field: 'basedOn', headerName: 'Based On' },
    { field: 'reference', headerName: 'Reference' },
  ]

  const rows = provenanceAnnotations.map(
    (annotation: ProvenanceAnnotation, index: number) => ({
      id: index,
      field: `${annotation.field}`,
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
                provenanceAnnotations[rowData.row.id as number],
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
            setProvenanceDialogInfo({ open: true, data: {} })
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
            setProvenanceDialogInfo({
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
        {provenanceDialogInfo.open && (
          <ProvenanceModal
            handleClose={handleClose}
            model={model}
            clickedFeature={clickedFeature}
            loadData={provenanceDialogInfo.data}
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
              await fetch(`${model.apolloUrl}/provenance/delete`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
              })
            }}
            objToDeleteName={`Gene Product Annotation: ${
              (selectedAnnotation as ProvenanceAnnotation).productName
            }`}
          />
        )}
        {openImportModal && (
          <TextImportModal
            model={model}
            handleClose={() => {
              setOpenImportModal(false)
            }}
            endpointUrl={`${model.apolloUrl}/provenance/save`}
            from="Provenance"
            helpText={`Format is:
            {
                "feature": "",
                "field": "",
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

export default observer(ProvenanceEditingTabDetail)
