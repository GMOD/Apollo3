import { AbstractSessionModel, AppRootModel } from '@jbrowse/core/util'
import DeleteIcon from '@mui/icons-material/Delete'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material'
import {
  DataGrid,
  GridActionsCellItem,
  GridCallbackDetails,
  GridCellEditCommitParams,
  GridColumns,
  GridRowId,
  GridRowParams,
  GridToolbar,
  MuiEvent,
} from '@mui/x-data-grid'
import { ChangeManager, UserChange } from 'apollo-shared'
import { getRoot } from 'mobx-state-tree'
import React, { useCallback, useMemo, useState } from 'react'

import { useUsers } from './'

// const users = [
//   { id: 'user0123', email: '0123@demo.com', role: 'read-only' },
//   { id: 'user4567', email: '4567@demo.com', role: 'user' },
//   { id: 'user8910', email: '8910@demo.com', role: 'admin' },
// ]

interface ManageUsersProps {
  session: AbstractSessionModel
  handleClose(): void
  changeManager: ChangeManager
}

export function ManageUsers({
  session,
  handleClose,
  changeManager,
}: ManageUsersProps) {
  const { internetAccounts } = getRoot(session) as AppRootModel
  const [errorMessage, setErrorMessage] = useState('')

  const users = useUsers(internetAccounts, setErrorMessage)
  // const [rows, setRows] = useState<UserData[]>(users)

  const deleteUser = useCallback(
    (id: GridRowId) => () => {
      // setTimeout(() => {
      //   setRows((prevRows) => prevRows.filter((row) => row.id !== id))
      // })
    },
    [],
  )

  const gridColumns = useMemo<GridColumns>(
    () => [
      { field: 'id', headerName: 'User', width: 140 },
      { field: 'email', headerName: 'Email', width: 160 },
      {
        field: 'role',
        headerName: 'Role',
        width: 140,
        type: 'singleSelect',
        valueOptions: ['readOnly', 'user', 'admin'],
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

  async function onChangeTableCell(change: UserChange, event: MuiEvent) {
    changeManager.submit(change)
  }

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
            // experimentalFeatures={{ newEditingApi: true }}
            onCellEditCommit={(
              params: GridCellEditCommitParams,
              event: MuiEvent,
              details: GridCallbackDetails,
            ) => {
              if (params.field === 'role') {
                const change = new UserChange({
                  changedIds: ['1'],
                  typeName: 'UserChange',
                  role: params.value,
                  userId: 2,
                  assemblyId: 'XXXXXXX',
                })
                onChangeTableCell(change, event)
              }
            }}
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
      {errorMessage ? (
        <DialogContent>
          <DialogContentText color="error">{errorMessage}</DialogContentText>
        </DialogContent>
      ) : null}
    </Dialog>
  )
}
