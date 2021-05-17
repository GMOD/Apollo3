import { Button, makeStyles, fade } from '@material-ui/core'
import {
  DataGrid,
  GridEditCellPropsParams,
  GridEditRowsModel,
} from '@material-ui/data-grid'
import { observer } from 'mobx-react'
import React, { useState } from 'react'
import { AplInputProps, ApolloFeature } from '../ApolloFeatureDetail'
import CodingModal from './CodingModal'

interface CodingRow {
  type: string
  start: number
  length: number
}

const useStyles = makeStyles(() => {
  return {
    root: {
      '& .MuiDataGrid-cellEditing': {
        backgroundColor: 'rgb(255,215,115, 0.19)',
        color: '#1a3e72',
      },
      '& .Mui-error': {
        backgroundColor: `rgb(126,10,15,  0.1)`,
        color: '#750f0f',
      },
      '& .MuiDataGrid-cellEditable': {
        backgroundColor: fade('#376331', 0.6),
      },
    },
  }
})

const CodingEditingTabDetail = ({
  clickedFeature,
  props,
}: {
  clickedFeature: ApolloFeature
  props: AplInputProps
}) => {
  const { model } = props
  const [selected, setSelected] = useState<ApolloFeature | undefined>(undefined)
  const [codingModalInfo, setCodingModalInfo] = useState({
    open: false,
    data: {},
  })
  const [editRowsModel, setEditRowsModel] = React.useState<GridEditRowsModel>(
    {},
  )
  const classes = useStyles()

  const handleClose = () => {
    setCodingModalInfo({ open: false, data: {} })
  }

  const validateLength = (value: number, position: string) => {
    if (value < 0) {
      return false
    }

    if (position === 'start') {
      if (value < selected?.location.fmax) {
        return true
      }
    } else {
      if (value > selected?.location.fmin) {
        return true
      }
    }
    return false
  }

  const handleEditCellChange = (
    { id, field, props }: GridEditCellPropsParams,
    event: any,
  ) => {
    const value = parseInt(`${props.value}`)
    const isValid = validateLength(value, field)
    const newState: GridEditRowsModel = {}
    newState[id] = {
      ...editRowsModel[id],
      [field]: { ...props, error: !isValid },
    }
    setEditRowsModel(state => ({ ...state, ...newState }))
    event.stopPropagation()
  }

  const handleEditCellChangeCommitted = ({
    id,
    field,
    props,
  }: GridEditCellPropsParams) => {
    let postChangeCoding: any = JSON.parse(JSON.stringify(selected))
    console.log(postChangeCoding)
    // send signal
  }

  const columns = [
    { field: 'type', headerName: 'Type', flex: 0.5 },
    {
      field: 'start',
      headerName: 'Start',
      type: 'number',
      editable: true,
      flex: 0.75,
    },
    {
      field: 'end',
      headerName: 'End',
      type: 'number',
      editable: true,
      flex: 0.75,
    },
    { field: 'length', headerName: 'Length' },
  ]

  const rows: CodingRow[] = clickedFeature.children.map(
    (child: ApolloFeature, index: number) => ({
      id: index,
      type: child.type.name,
      // increases the fmin by 1 for display since coordinates are handled as zero-based on server-side
      start: child.location.fmin + 1, // have this editable
      end: child.location.fmax, // have this editable
      length: child.location.fmax - child.location.fmin,
    }),
  )

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
            onRowClick={rowData => {
              setSelected(clickedFeature.children[rowData.row.id as number])
            }}
            onEditCellChange={handleEditCellChange}
            onEditCellChangeCommitted={handleEditCellChangeCommitted}
            editRowsModel={editRowsModel}
          />
        </div>
      </div>
      <div style={{ margin: 5 }}>
        <Button
          color="secondary"
          variant="contained"
          disabled={!selected}
          onClick={async () => {
            setCodingModalInfo({
              open: true,
              data: {
                selected,
              },
            })
          }}
        >
          Edit
        </Button>
        {codingModalInfo.open && (
          <CodingModal
            handleClose={handleClose}
            model={model}
            clickedFeature={clickedFeature}
            loadData={codingModalInfo.data}
          />
        )}
      </div>
    </>
  )
}

export default observer(CodingEditingTabDetail)
