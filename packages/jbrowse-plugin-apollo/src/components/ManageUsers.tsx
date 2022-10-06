import { AbstractSessionModel } from '@jbrowse/core/util'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from '@mui/material'
import { DataGrid, GridColumns, GridToolbar } from '@mui/x-data-grid'
import React from 'react'

const users = [
  { id: 'user0123', email: '0123@demo.com', role: 'read-only' },
  { id: 'user4567', email: '4567@demo.com', role: 'user' },
  { id: 'user8910', email: '8910@demo.com', role: 'admin' },
]

interface ManageUsersProps {
  session: AbstractSessionModel
  handleClose(): void
}

export function ManageUsers({ session, handleClose }: ManageUsersProps) {
  const gridColumns: GridColumns = [
    { field: 'id', headerName: 'User', width: 140 },
    { field: 'email', headerName: 'Email', width: 160 },
    { field: 'role', headerName: 'Role', width: 140 },
  ]

  return (
    <Dialog open maxWidth="xl" data-testid="login-apollo" fullScreen>
      <DialogTitle>Manage users</DialogTitle>

      <DialogContent>
        <div style={{ height: '100%', width: '100%' }}>
          <DataGrid
            autoPageSize
            pagination
            rows={users}
            columns={gridColumns}
            getRowId={(row) => row.id}
            components={{ Toolbar: GridToolbar }}
            getRowHeight={() => 'auto'}
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
