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
  GridCallbackDetails,
  GridCellEditCommitParams,
  GridCellParams,
  GridColumns,
  GridRowId,
  GridRowParams,
  GridToolbar,
  MuiEvent,
} from '@mui/x-data-grid'
import { ChangeManager, DeleteUserChange, UserChange } from 'apollo-shared'
import { getRoot } from 'mobx-state-tree'
import React, { useCallback, useEffect, useState } from 'react'

import { ApolloInternetAccountModel } from '../ApolloInternetAccount/model'

interface UserResponse {
  _id: string
  username: string
  email: string
  role: string[]
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
  session,
  handleClose,
  changeManager,
}: ManageUsersProps) {
  const { internetAccounts } = getRoot(session)
  const apolloInternetAccounts = internetAccounts.filter(
    (ia) =>
      ia.type === 'ApolloInternetAccount' && ia.getRole()?.includes('admin'),
  )
  if (!apolloInternetAccounts.length) {
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
      const response = await apolloFetch(uri, {
        method: 'GET',
      })
      if (!response.ok) {
        let msg
        try {
          msg = await response.text()
        } catch (e) {
          msg = ''
        }
        setErrorMessage(
          `Error when getting user data from db — ${response.status} 
          (${response.statusText})${msg ? ` (${msg})` : ''}`,
        )
        return
      }
      const data = (await response.json()) as UserResponse[]
      setUsers(data)
    }
  }, [selectedInternetAcount])

  useEffect(() => {
    getUsers()
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

  const gridColumns: GridColumns = [
    { field: 'username', headerName: 'User', width: 140 },
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
          onClick={() => {
            if (window.confirm('Delete this user?')) {
              deleteUser(params.id)
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
            getRowId={(row) => row._id}
            components={{ Toolbar: GridToolbar }}
            getRowHeight={() => 'auto'}
            isCellEditable={(params: GridCellParams) =>
              !isCurrentUser(params.id)
            }
            onCellEditCommit={(
              params: GridCellEditCommitParams,
              event: MuiEvent,
              details: GridCallbackDetails,
            ) => {
              if (params.field === 'role') {
                const change = new UserChange({
                  typeName: 'UserChange',
                  role: params.value,
                  userId: params.id as string,
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
