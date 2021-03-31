import { Button, makeStyles } from '@material-ui/core'
import { observer } from 'mobx-react'
import React, { useState, useEffect } from 'react'
import {
  AplInputProps,
  ApolloData,
  ApolloFeature,
} from '../ApolloFeatureDetail'

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
  const [selectedRow, setSelectedRow] = useState('') // when find data to loop thru use this

  const columns = [
    { field: 'name', headerName: 'Name' },
    { field: 'evidence', headerName: 'Evidence' },
    { field: 'basedOn', headerName: 'Based On' },
    { field: 'reference', headerName: 'Reference' },
  ]

  const rows = goAnnotations.map((annotation: GoAnnotation) => ({
    name: annotation.name,
    evidence: annotation.evidence,
    basedOn: annotation.basedOn,
    reference: annotation.reference,
  }))

  return (
    <>
      <div>
        {/* <DataGrid
        rows={rows}
        columns={columns}
        sortModel={[{ field: 'reference', sort: 'asc' as GridSortDirection }]}
      /> */}
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Evidence</th>
              <th>Based On</th>
              <th>Reference</th>
            </tr>
          </thead>
        </table>
      </div>
      {goAnnotations.map(annotation => {
        const { name, evidence, basedOn, reference } = annotation
        return (
          <tr key={name} onClick={() => setSelectedRow(name)}>
            <td>{name}</td>
            <td>{evidence}</td>
            <td>{basedOn}</td>
            <td>{reference}</td>
          </tr>
        )
      })}
      <div className={classes.buttonDiv}>
        <Button
          color="secondary"
          variant="contained"
          onClick={async () => {}} // opens up a dialog form
        >
          New
        </Button>
        <Button
          color="secondary"
          variant="contained"
          onClick={async () => {}} // opens up the dialog form, populates with info
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
      </div>
    </>
  )
}

export default observer(GoEditingTabDetail)
