import { Button, makeStyles } from '@material-ui/core'
import { observer } from 'mobx-react'
import React, { useState, useEffect } from 'react'
import { AplInputProps, ApolloFeature } from '../ApolloFeatureDetail'
import GoModal from './GoModal'
import { DataGrid, GridSortDirection } from '@material-ui/data-grid'

interface GoAnnotation {
  [key: string]: string
}

const useStyles = makeStyles(theme => ({
  buttonDiv: {
    margin: theme.spacing(5),
  },
}))

const GoEditingTabDetail = ({
  clickedFeature,
  props,
}: {
  clickedFeature: ApolloFeature
  props: AplInputProps
}) => {
  const { model } = props
  const classes = useStyles()
  const [goAnnotations, setGoAnnotations] = useState([])
  const [goDialogInfo, setGoDialogInfo] = useState({ open: false, data: {} })

  const handleClose = () => {
    setGoDialogInfo({ open: false, data: {} })
  }

  useEffect(() => {
    async function fetchGoAnnotations() {
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
      setGoAnnotations(json.annotations || [])
    }
    fetchGoAnnotations()
  }, [clickedFeature.uniquename, model.apolloUrl, model.apolloId])

  console.log('after', goAnnotations)
  const [selectedAnnotation, setSelectedAnnotation] = useState({}) // when find data to loop thru use this

  const columns = [
    { field: 'name', headerName: 'Name' },
    { field: 'evidence', headerName: 'Evidence' },
    { field: 'basedOn', headerName: 'Based On' },
    { field: 'reference', headerName: 'Reference' },
  ]

  const rows = goAnnotations.map((annotation: GoAnnotation, index: number) => ({
    id: index,
    name: annotation.name,
    evidence: annotation.evidence,
    basedOn: annotation.basedOn,
    reference: annotation.reference,
  }))

  return (
    <>
      <div style={{ height: 400, width: '100%' }}>
        <div style={{ display: 'flex', height: '100%' }}>
          <DataGrid
            pageSize={25}
            hideFooterSelectedRowCount={true}
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
      <div className={classes.buttonDiv}>
        <Button
          color="secondary"
          variant="contained"
          onClick={async () => setGoDialogInfo({ open: true, data: {} })} // opens up a dialog form
        >
          New
        </Button>
        <Button
          color="secondary"
          variant="contained"
          onClick={async () => {
            setGoDialogInfo({
              open: true,
              data: {
                selectedAnnotation,
              },
            })
          }} // opens up the dialog form, populates with info
        >
          Edit
        </Button>
        <Button
          color="secondary"
          variant="contained"
          onClick={async () => {}} // deletes the current selected row from goAnnotations, sends fetch to update
        >
          Delete
        </Button>
        {goDialogInfo.open && (
          <GoModal
            handleClose={handleClose}
            model={model}
            clickedFeature={clickedFeature}
            data={goDialogInfo.data}
          />
        )}
      </div>
    </>
  )
}

export default observer(GoEditingTabDetail)
