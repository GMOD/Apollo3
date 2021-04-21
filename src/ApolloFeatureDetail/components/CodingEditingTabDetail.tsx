import { Button } from '@material-ui/core'
import { DataGrid } from '@material-ui/data-grid'
import { observer } from 'mobx-react'
import React, { useState } from 'react'
import { AplInputProps, ApolloFeature } from '../ApolloFeatureDetail'
import CodingModal from './CodingModal'

interface CodingRow {
  type: string
  start: number
  length: number
}

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

  const handleClose = () => {
    setCodingModalInfo({ open: false, data: {} })
  }

  const columns = [
    { field: 'type', headerName: 'Type' },
    { field: 'start', headerName: 'Start' },
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
            disableColumnMenu
            hideFooterSelectedRowCount
            pageSize={25}
            rows={rows}
            columns={columns}
            onRowClick={rowData => {
              setSelected(clickedFeature.children[rowData.row.id as number])
            }}
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
