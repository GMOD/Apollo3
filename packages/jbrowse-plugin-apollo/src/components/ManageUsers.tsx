import { AbstractSessionModel, AppRootModel } from '@jbrowse/core/util'
import DeleteIcon from '@mui/icons-material/Delete'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  MenuItem,
  Select,
  SelectChangeEvent,
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

import { ApolloInternetAccountModel } from '../ApolloInternetAccount/model'
import { useUsers } from './'

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
  const apolloInternetAccounts = internetAccounts.filter(
    (ia) => ia.type === 'ApolloInternetAccount',
  ) as ApolloInternetAccountModel[]
  if (!apolloInternetAccounts.length) {
    throw new Error('No Apollo internet account found')
  }
  // const { internetAccounts } = getRoot(session) as AppRootModel
  const [errorMessage, setErrorMessage] = useState('')
  const [selectedInternetAcount, setSelectedInternetAcount] = useState(
    apolloInternetAccounts[0],
  )
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

  function handleChangeInternetAccount(e: SelectChangeEvent<string>) {
    // setSubmitted(false)
    const newlySelectedInternetAccount = apolloInternetAccounts.find(
      (ia) => ia.internetAccountId === e.target.value,
    )
    if (!newlySelectedInternetAccount) {
      throw new Error(
        `Could not find internetAccount with ID "${e.target.value}"`,
      )
    }
    setSelectedInternetAcount(newlySelectedInternetAccount)
  }

  async function onChangeTableCell(change: UserChange, event: MuiEvent) {
    changeManager.submit(change, {
      internetAccountId: selectedInternetAcount.internetAccountId,
    })
  }

  return (
    <Dialog open maxWidth="xl" data-testid="login-apollo" fullScreen>
      <DialogTitle>Manage users</DialogTitle>

      <DialogContent>
        {apolloInternetAccounts.length > 1 ? (
          <>
            <DialogContentText>Select account</DialogContentText>
            <Select
              value={selectedInternetAcount.internetAccountId}
              onChange={handleChangeInternetAccount}
              disabled={!errorMessage}
            >
              {internetAccounts.map((option) => (
                <MenuItem key={option.id} value={option.internetAccountId}>
                  {option.name}
                </MenuItem>
              ))}
            </Select>
          </>
        ) : null}
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
                  userId: Number(params.id),
                  assemblyId: '635112a914e49e7215bcc4ff',
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
