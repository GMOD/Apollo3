import { DataGrid } from '@material-ui/data-grid'
import { observer } from 'mobx-react'
import React from 'react'
import { AplInputProps, ApolloFeature } from '../ApolloFeatureDetail'

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
  const columns = [
    { field: 'type', headerName: 'Type' },
    { field: 'start', headerName: 'Start' },
    { field: 'length', headerName: 'Length' },
    { field: 'feature', headerName: 'Feature', hide: true },
  ]

  const rows: CodingRow[] = clickedFeature.children.map(
    (child: ApolloFeature, index: number) => ({
      id: index,
      type: child.type.name,
      // increases the fmin by 1 for display since coordinates are handled as zero-based on server-side
      start: child.location.fmin + 1, // have this editable
      end: child.location.fmax, // have this editable
      length: child.location.fmax - child.location.fmin,
      feature: child,
    }),
  )

  // consider using data grid instead of table
  return (
    <div style={{ height: 400, width: '100%' }}>
      <div style={{ display: 'flex', height: '100%' }}>
        <DataGrid
          pageSize={25}
          hideFooterSelectedRowCount={true}
          rows={rows}
          columns={columns}
        />
      </div>
    </div>
  )
}

export default observer(CodingEditingTabDetail)
