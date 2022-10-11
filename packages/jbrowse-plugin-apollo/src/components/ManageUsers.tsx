import { AbstractSessionModel } from '@jbrowse/core/util'
import DeleteIcon from '@mui/icons-material/Delete'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from '@mui/material'
import {
  DataGrid,
  GridActionsCellItem,
  GridColumns,
  GridRowId,
  GridRowParams,
  GridToolbar,
} from '@mui/x-data-grid'
import React, { useCallback, useMemo, useState } from 'react'

const users = [
  { id: 'user0123', email: '0123@demo.com', role: 'read-only' },
  { id: 'user4567', email: '4567@demo.com', role: 'user' },
  { id: 'user8910', email: '8910@demo.com', role: 'admin' },
]

interface ManageUsersProps {
  session: AbstractSessionModel
  handleClose(): void
}

type Row = typeof users[number]

export function ManageUsers({ session, handleClose }: ManageUsersProps) {
  const [rows, setRows] = useState<Row[]>(users)

  const deleteUser = useCallback(
    (id: GridRowId) => () => {
      setTimeout(() => {
        setRows((prevRows) => prevRows.filter((row) => row.id !== id))
      })
    },
    [],
  )

  const gridColumns = useMemo<GridColumns<Row>>(
    () => [
      { field: 'id', headerName: 'User', width: 140 },
      { field: 'email', headerName: 'Email', width: 160 },
      {
        field: 'role',
        headerName: 'Role',
        width: 140,
        type: 'singleSelect',
        valueOptions: ['read-only', 'user', 'admin'],
        editable: true,
      },
      {
        field: 'actions',
        type: 'actions',
        getActions: (params: GridRowParams) => [
          <GridActionsCellItem
            icon={<DeleteIcon />}
            onClick={deleteUser(params.id)}
            label="Delete"
          />,
        ],
      },
    ],
    [deleteUser],
  )

  return (
    <Dialog open maxWidth="xl" data-testid="login-apollo" fullScreen>
      <DialogTitle>Manage users</DialogTitle>

      <DialogContent>
        <div style={{ height: '100%', width: '100%' }}>
          <DataGrid
            autoPageSize
            pagination
            rows={rows}
            columns={gridColumns}
            getRowId={(row) => row.id}
            components={{ Toolbar: GridToolbar }}
            getRowHeight={() => 'auto'}
            experimentalFeatures={{ newEditingApi: true }}
          />
        </div>
      </DialogContent>
      <DialogActions>
        <Button
          variant="outlined"
          type="submit"
          onClick={() => {
            handleClose()
          }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
}
