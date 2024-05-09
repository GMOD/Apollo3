/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { AbstractRootModel } from '@jbrowse/core/util'
import DeleteIcon from '@mui/icons-material/Delete'
import {
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
  MenuItem,
  Select,
  SelectChangeEvent,
} from '@mui/material'
import {
  DataGrid,
  GridActionsCellItem,
  GridCellParams,
  GridColDef,
  GridRowId,
  GridRowModel,
  GridRowParams,
  GridToolbar,
} from '@mui/x-data-grid'
import { DeleteUserChange, UserChange } from 'apollo-shared'
import { getRoot } from 'mobx-state-tree'
import React, { useCallback, useEffect, useState } from 'react'

import { ApolloInternetAccountModel } from '../ApolloInternetAccount/model'
import { ChangeManager } from '../ChangeManager'
import { ApolloSessionModel } from '../session'
import { createFetchErrorMessage } from '../util'
import { Dialog } from './Dialog'

interface UserResponse {
  _id: string
  username: string
  email: string
  role?: '' | 'admin' | 'user' | 'readOnly'
}

interface ManageUsersProps {
  session: ApolloSessionModel
  handleClose(): void
  changeManager: ChangeManager
}

interface ApolloRootModel extends AbstractRootModel {
  internetAccounts: ApolloInternetAccountModel[]
}

export function ManageUsers({
  changeManager,
  handleClose,
  session,
}: ManageUsersProps) {
  const { internetAccounts } = getRoot<ApolloRootModel>(session)
  const apolloInternetAccounts = internetAccounts.filter(
    (ia) => ia.type === 'ApolloInternetAccount' && ia.role?.includes('admin'),
  )
  if (apolloInternetAccounts.length === 0) {
    throw new Error('No Apollo internet account found')
  }
  const [errorMessage, setErrorMessage] = useState('')
  const [selectedInternetAccount, setSelectedInternetAccount] = useState(
    apolloInternetAccounts[0],
  )
  const [users, setUsers] = useState<UserResponse[]>([])

  const getUsers = useCallback(async () => {
    const { baseURL } = selectedInternetAccount
    const uri = new URL('/users', baseURL).href
    const apolloFetch = selectedInternetAccount.getFetcher({
      locationType: 'UriLocation',
      uri,
    })
    if (apolloFetch) {
      const response = await apolloFetch(uri, { method: 'GET' })
      if (!response.ok) {
        const newErrorMessage = await createFetchErrorMessage(
          response,
          'Error when getting user data from db',
        )
        setErrorMessage(newErrorMessage)
        return
      }
      const data = (await response.json()) as UserResponse[]
      setUsers(data.map((u) => (u.role === undefined ? { ...u, role: '' } : u)))
    }
  }, [selectedInternetAccount])

  useEffect(() => {
    getUsers().catch((error) => {
      setErrorMessage(String(error))
    })
  }, [getUsers])

  async function deleteUser(id: GridRowId) {
    const change = new DeleteUserChange({
      typeName: 'DeleteUserChange',
      userId: id as string,
    })
    await changeManager.submit(change, {
      internetAccountId: selectedInternetAccount.internetAccountId,
    })
    setUsers((prevUsers) => prevUsers.filter((row) => row._id !== id))
  }

  function isCurrentUser(id: GridRowId) {
    if (id === selectedInternetAccount.getUserId()) {
      return true
    }
    return false
  }

  const gridColumns: GridColDef[] = [
    { field: 'username', headerName: 'User', width: 140 },
    { field: 'email', headerName: 'Email', width: 160 },
    {
      field: 'role',
      headerName: 'Role',
      width: 140,
      type: 'singleSelect',
      valueOptions: ['', 'readOnly', 'user', 'admin'],
      editable: true,
    },
    {
      field: 'actions',
      type: 'actions',
      getActions: (params: GridRowParams) => [
        <GridActionsCellItem
          key={`delete-${params.id}`}
          icon={<DeleteIcon />}
          onClick={async () => {
            if (window.confirm('Delete this user?')) {
              await deleteUser(params.id)
            }
          }}
          disabled={isCurrentUser(params.id)}
          label="Delete"
        />,
      ],
    },
  ]

  function handleChangeInternetAccount(e: SelectChangeEvent) {
    const newlySelectedInternetAccount = apolloInternetAccounts.find(
      (ia) => ia.internetAccountId === e.target.value,
    )
    if (!newlySelectedInternetAccount) {
      throw new Error(
        `Could not find internetAccount with ID "${e.target.value}"`,
      )
    }
    setSelectedInternetAccount(newlySelectedInternetAccount)
  }

  async function processRowUpdate(newRow: GridRowModel) {
    const change = new UserChange({
      typeName: 'UserChange',
      role: newRow.role,
      userId: newRow._id,
    })
    await changeManager.submit(change, {
      internetAccountId: selectedInternetAccount.internetAccountId,
    })
    return newRow
  }

  return (
    <Dialog
      open
      fullScreen
      title="Manage users"
      handleClose={handleClose}
      data-testid="manage-users"
    >
      <DialogContent>
        {apolloInternetAccounts.length > 1 ? (
          <>
            <DialogContentText>Select account</DialogContentText>
            <Select
              value={selectedInternetAccount.internetAccountId}
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
            pagination
            rows={users}
            columns={gridColumns}
            getRowId={(row) => row._id}
            slots={{ toolbar: GridToolbar }}
            getRowHeight={() => 'auto'}
            isCellEditable={(params: GridCellParams) =>
              !isCurrentUser(params.id)
            }
            processRowUpdate={processRowUpdate}
            onProcessRowUpdateError={(error) => {
              setErrorMessage(String(error))
            }}
          />
        </div>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" type="submit" onClick={handleClose}>
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
