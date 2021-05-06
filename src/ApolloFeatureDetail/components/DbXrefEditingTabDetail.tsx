import { Button, makeStyles } from '@material-ui/core'
import { observer } from 'mobx-react'
import React, { useState, useEffect } from 'react'
import { AplInputProps, ApolloFeature } from '../ApolloFeatureDetail'
import DbXrefModal from './DbXrefModal'
import {
  DataGrid,
  GridSortDirection,
  GridEditCellPropsParams,
} from '@material-ui/data-grid'
import ConfirmDeleteModal from './ConfirmDeleteModal'
import TextImportModal from './TextImportModal'

interface DbXref {
  [key: string]: string
}
const useStyles = makeStyles(() => ({
  buttons: {
    marginRight: 10,
  },
}))

const DbXrefEditingTabDetail = ({
  clickedFeature,
  props,
}: {
  clickedFeature: ApolloFeature
  props: AplInputProps
}) => {
  const { model } = props
  const classes = useStyles()
  const [dbXrefs, setDbXrefs] = useState([])
  const [dbXrefDialogInfo, setDbXrefDialogInfo] = useState({
    open: false,
    data: {},
  })
  const [openConfirmDeleteModal, setOpenConfirmDeleteModal] = useState(false)
  const [openImportModal, setOpenImportModal] = useState(false)

  const handleClose = () => {
    setDbXrefDialogInfo({ open: false, data: {} })
  }

  const handleEditCellChange = ({
    id,
    field,
    props,
  }: GridEditCellPropsParams) => {}

  useEffect(() => {
    async function fetchDbXrefs() {
      const data = {
        username: sessionStorage.getItem(`${model.apolloId}-apolloUsername`), // get from renderProps later
        password: sessionStorage.getItem(`${model.apolloId}-apolloPassword`),
        sequence: clickedFeature.sequence,
        organism: 'Fictitious', // need to find where in code is organism name
        uniquename: clickedFeature.uniquename,
      }

      const response = await fetch(
        `${model.apolloUrl}/annotationEditor/getDbxrefs`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        },
      )
      const json = await response.json()
      setDbXrefs(json.annotations || [])
    }
    fetchDbXrefs()
  }, [
    clickedFeature.uniquename,
    model.apolloUrl,
    model.apolloId,
    clickedFeature.sequence,
  ])

  const [selectedAnnotation, setSelectedAnnotation] = useState({})

  const columns = [
    { field: 'prefix', headerName: 'Prefix', flex: 1, editable: true },
    { field: 'accession', headerName: 'Accession', flex: 1, editable: true },
  ]

  const rows = dbXrefs.map((annotation: DbXref, index: number) => ({
    id: index,
    prefix: annotation.tag,
    accession: annotation.value,
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
            sortModel={[{ field: 'prefix', sort: 'asc' as GridSortDirection }]}
            onRowClick={rowData => {
              setSelectedAnnotation(dbXrefs[rowData.row.id as number])
            }}
            onEditCellChange={handleEditCellChange}
          />
        </div>
      </div>
      <div style={{ margin: 5 }}>
        <Button
          color="secondary"
          variant="contained"
          className={classes.buttons}
          onClick={async () => setDbXrefDialogInfo({ open: true, data: {} })}
        >
          New
        </Button>
        <Button
          color="secondary"
          variant="contained"
          className={classes.buttons}
          disabled={Object.keys(selectedAnnotation).length === 0}
          onClick={async () => {
            setDbXrefDialogInfo({
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
        {dbXrefDialogInfo.open && (
          <DbXrefModal
            handleClose={handleClose}
            model={model}
            clickedFeature={clickedFeature}
            loadData={dbXrefDialogInfo.data}
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
                sequence: clickedFeature.sequence,
                organism: 'Fictitious',
                features: [
                  {
                    uniquename: clickedFeature.uniquename,
                    dbxrefs: [
                      {
                        db: (selectedAnnotation as DbXref).prefix,
                        accession: (selectedAnnotation as DbXref).accession,
                      },
                    ],
                  },
                ],
              }
              await fetch(`${model.apolloUrl}/annotationEditor/deleteDbxref`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
              })
            }}
            objToDeleteName={`DbXref: ${(selectedAnnotation as DbXref).prefix}`}
          />
        )}
        {openImportModal && (
          <TextImportModal
            model={model}
            handleClose={() => {
              setOpenImportModal(false)
            }}
            endpointUrl={`${model.apolloUrl}/annotationEditor/addDbxref`}
            from="DbXref"
            helpText={`Format is:
            {
                "sequence": "",
                "organism": "",
                "features": [{"uniquename": "", "dbxrefs": [{ "db": "", "accession": "" }]}]
            }`}
          />
        )}
      </div>
    </>
  )
}

export default observer(DbXrefEditingTabDetail)
