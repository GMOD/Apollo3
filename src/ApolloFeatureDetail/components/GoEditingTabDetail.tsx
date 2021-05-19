import { Button, makeStyles } from '@material-ui/core'
import { observer } from 'mobx-react'
import React, { useState, useEffect } from 'react'
import { AplInputProps, ApolloFeature } from '../ApolloFeatureDetail'
import GOModal from './GOModal'
import { DataGrid, GridSortDirection } from '@material-ui/data-grid'
import ConfirmDeleteModal from './ConfirmDeleteModal'
import TextImportModal from './TextImportModal'

interface GOAnnotation {
  [key: string]: string
}

const useStyles = makeStyles(theme => ({
  buttons: {
    marginRight: 10,
  },
}))

const GOEditingTabDetail = ({
  clickedFeature,
  props,
}: {
  clickedFeature: ApolloFeature
  props: AplInputProps
}) => {
  const { model } = props
  const classes = useStyles()
  const [goAnnotations, setGOAnnotations] = useState([])
  const [goDialogInfo, setGODialogInfo] = useState({ open: false, data: {} })
  const [openConfirmDeleteModal, setOpenConfirmDeleteModal] = useState(false)
  const [openImportModal, setOpenImportModal] = useState(false)

  const handleClose = () => {
    setGODialogInfo({ open: false, data: {} })
  }

  useEffect(() => {
    async function fetchGOAnnotations() {
      const data = {
        username: sessionStorage.getItem(`${model.apolloId}-apolloUsername`), // get from renderProps later
        password: sessionStorage.getItem(`${model.apolloId}-apolloPassword`),
        uniqueName: clickedFeature.uniquename,
      }

      const response = await fetch(`${model.apolloUrl}/goAnnotation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })
      const json = await response.json()
      setGOAnnotations(json.annotations || [])
    }
    fetchGOAnnotations()
  }, [clickedFeature.uniquename, model.apolloUrl, model.apolloId])

  const [selectedAnnotation, setSelectedAnnotation] = useState({})

  const columns = [
    { field: 'name', headerName: 'Name', flex: 1.5 },
    { field: 'evidence', headerName: 'Evidence', flex: 1 },
    { field: 'basedOn', headerName: 'Based On', flex: 1.5 },
    { field: 'reference', headerName: 'Reference', flex: 1 },
  ]

  const rows = goAnnotations.map((annotation: GOAnnotation, index: number) => ({
    id: index,
    name: `${annotation.goTermLabel} (${annotation.goTerm})`,
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
              setSelectedAnnotation(goAnnotations[rowData.row.id as number])
            }}
          />
        </div>
      </div>
      <div style={{ margin: 5 }}>
        <Button
          color="secondary"
          variant="contained"
          className={classes.buttons}
          onClick={async () => setGODialogInfo({ open: true, data: {} })}
        >
          New
        </Button>
        <Button
          color="secondary"
          variant="contained"
          className={classes.buttons}
          disabled={Object.keys(selectedAnnotation).length === 0}
          onClick={async () => {
            setGODialogInfo({
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
        {goDialogInfo.open && (
          <GOModal
            handleClose={handleClose}
            model={model}
            clickedFeature={clickedFeature}
            loadData={goDialogInfo.data}
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
              await fetch(`${model.apolloUrl}/goAnnotation/delete`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
              })
            }}
            objToDeleteName={`GO Annotation: ${
              (selectedAnnotation as GOAnnotation).goTerm
            }`}
          />
        )}
        {openImportModal && (
          <TextImportModal
            model={model}
            handleClose={() => {
              setOpenImportModal(false)
            }}
            endpointUrl={`${model.apolloUrl}/goAnnotation/save`}
            from="GO Annotation"
            helpText={`Format is:
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
          }`}
          />
        )}
      </div>
    </>
  )
}

export default observer(GOEditingTabDetail)
