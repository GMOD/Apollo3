import { AbstractRootModel, AbstractSessionModel } from '@jbrowse/core/util'
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
import { createFetchErrorMessage } from '../util'

interface UserResponse {
  _id: string
  username: string
  email: string
  role?: '' | 'admin' | 'user' | 'readOnly'
}

interface ManageUsersProps {
  session: AbstractSessionModel
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
  const { internetAccounts } = getRoot(session) as ApolloRootModel
  const apolloInternetAccounts = internetAccounts.filter(
    (ia) =>
      ia.type === 'ApolloInternetAccount' && ia.getRole()?.includes('admin'),
  )
  if (apolloInternetAccounts.length === 0) {
    throw new Error('No Apollo internet account found')
  }
  const [errorMessage, setErrorMessage] = useState('')
  const [selectedInternetAcount, setSelectedInternetAcount] = useState(
    apolloInternetAccounts[0],
  )
  const [users, setUsers] = useState<UserResponse[]>([])

  const getUsers = useCallback(async () => {
    const { baseURL } = selectedInternetAcount
    const uri = new URL('/users', baseURL).href
    const apolloFetch = selectedInternetAcount?.getFetcher({
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
  }, [selectedInternetAcount])

  useEffect(() => {
    getUsers().catch((error) => setErrorMessage(String(error)))
  }, [getUsers])

  async function deleteUser(id: GridRowId) {
    const change = new DeleteUserChange({
      typeName: 'DeleteUserChange',
      userId: id as string,
    })
    await changeManager.submit(change, {
      internetAccountId: selectedInternetAcount.internetAccountId,
    })
    setUsers((prevUsers) => prevUsers.filter((row) => row._id !== id))
  }

  function isCurrentUser(id: GridRowId) {
    if (id === selectedInternetAcount.getUserId()) {
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

  function handleChangeInternetAccount(e: SelectChangeEvent<string>) {
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

  async function processRowUpdate(newRow: GridRowModel) {
    const change = new UserChange({
      typeName: 'UserChange',
      role: newRow.role,
      userId: newRow._id,
    })
    await changeManager.submit(change, {
      internetAccountId: selectedInternetAcount.internetAccountId,
    })
    return newRow
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
            getRowId={(row) => row._id}
            components={{ Toolbar: GridToolbar }}
            getRowHeight={() => 'auto'}
            isCellEditable={(params: GridCellParams) =>
              !isCurrentUser(params.id)
            }
            processRowUpdate={processRowUpdate}
            onProcessRowUpdateError={(error) => setErrorMessage(String(error))}
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
