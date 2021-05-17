import { Button, makeStyles, fade } from '@material-ui/core'
import { observer } from 'mobx-react'
import React, { useState, useEffect } from 'react'
import { AplInputProps, ApolloFeature } from '../ApolloFeatureDetail'
import AttributeModal from './AttributeModal'
import {
  DataGrid,
  GridSortDirection,
  GridEditCellPropsParams,
} from '@material-ui/data-grid'
import ConfirmDeleteModal from './ConfirmDeleteModal'
import TextImportModal from './TextImportModal'

interface Attribute {
  [key: string]: string
}
const useStyles = makeStyles(() => ({
  buttons: {
    marginRight: 10,
  },
  root: {
    '& .MuiDataGrid-cellEditable': {
      backgroundColor: fade('#376331', 0.6),
    },
  },
}))

const AttributeEditingTabDetail = ({
  clickedFeature,
  props,
}: {
  clickedFeature: ApolloFeature
  props: AplInputProps
}) => {
  const { model } = props
  const classes = useStyles()
  const [attributes, setAttributes] = useState([])
  const [attributeDialogInfo, setAttributeDialogInfo] = useState({
    open: false,
    data: {},
  })
  const [openConfirmDeleteModal, setOpenConfirmDeleteModal] = useState(false)
  const [openImportModal, setOpenImportModal] = useState(false)

  const handleClose = () => {
    setAttributeDialogInfo({ open: false, data: {} })
  }

  const handleEditCellChangeCommitted = ({
    id,
    field,
    props,
  }: GridEditCellPropsParams) => {
    const preChangeAttribute: Attribute = JSON.parse(
      JSON.stringify(attributes[id as number]),
    )
    const postChangeAttribute: Attribute = attributes[id as number]
    postChangeAttribute[field] = `${props.value}`
    const data = {
      username: sessionStorage.getItem(`${model.apolloId}-apolloUsername`),
      password: sessionStorage.getItem(`${model.apolloId}-apolloPassword`),
      sequence: clickedFeature.sequence,
      organism: 'Fictitious',
      features: [
        {
          uniquename: clickedFeature.uniquename,
          old_non_reserved_properties: [
            {
              tag: preChangeAttribute.tag,
              value: preChangeAttribute.value,
            },
          ],
          new_non_reserved_properties: [
            {
              tag: (selectedAnnotation as Attribute).tag,
              value: (selectedAnnotation as Attribute).value,
            },
          ],
        },
      ],
    }
    const endpointUrl = `${model.apolloUrl}/annotationEditor/updateAttribute`
    fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
  }

  useEffect(() => {
    async function fetchAttributes() {
      const data = {
        username: sessionStorage.getItem(`${model.apolloId}-apolloUsername`), // get from renderProps later
        password: sessionStorage.getItem(`${model.apolloId}-apolloPassword`),
        sequence: clickedFeature.sequence,
        organism: 'Fictitious', // need to find where in code is organism name
        uniquename: clickedFeature.uniquename,
      }

      const response = await fetch(
        `${model.apolloUrl}/annotationEditor/getAttributes`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        },
      )
      const json = await response.json()
      setAttributes(json.attributes || [])
    }
    fetchAttributes()
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

  const rows = attributes.map((annotation: Attribute, index: number) => ({
    id: index,
    prefix: annotation.tag,
    accession: annotation.value,
  }))

  return (
    <>
      <div style={{ height: 400, width: '100%' }}>
        <div style={{ display: 'flex', height: '100%' }}>
          <DataGrid
            className={classes.root}
            disableColumnMenu
            hideFooterSelectedRowCount
            pageSize={25}
            rows={rows}
            columns={columns}
            sortModel={[{ field: 'prefix', sort: 'asc' as GridSortDirection }]}
            onRowClick={rowData => {
              setSelectedAnnotation(attributes[rowData.row.id as number])
            }}
            onEditCellChangeCommitted={handleEditCellChangeCommitted}
          />
        </div>
      </div>
      <div style={{ margin: 5 }}>
        <Button
          color="secondary"
          variant="contained"
          className={classes.buttons}
          onClick={async () => setAttributeDialogInfo({ open: true, data: {} })}
        >
          New
        </Button>
        <Button
          color="secondary"
          variant="contained"
          className={classes.buttons}
          disabled={Object.keys(selectedAnnotation).length === 0}
          onClick={async () => {
            setAttributeDialogInfo({
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
        {attributeDialogInfo.open && (
          <AttributeModal
            handleClose={handleClose}
            model={model}
            clickedFeature={clickedFeature}
            loadData={attributeDialogInfo.data}
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
                    non_reserved_properties: [
                      {
                        db: (selectedAnnotation as Attribute).prefix,
                        accession: (selectedAnnotation as Attribute).accession,
                      },
                    ],
                  },
                ],
              }
              await fetch(
                `${model.apolloUrl}/annotationEditor/deleteAttribute`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(data),
                },
              )
            }}
            objToDeleteName={`Attribute: ${
              (selectedAnnotation as Attribute).prefix
            }`}
          />
        )}
        {openImportModal && (
          <TextImportModal
            model={model}
            handleClose={() => {
              setOpenImportModal(false)
            }}
            endpointUrl={`${model.apolloUrl}/annotationEditor/addAttribute`}
            from="Attribute"
            helpText={`Format is:
            {
                "sequence": "",
                "organism": "",
                "features": [{"uniquename": "", "non_reserved_properties": [{ "db": "", "accession": "" }]}]
            }`}
          />
        )}
      </div>
    </>
  )
}

export default observer(AttributeEditingTabDetail)
