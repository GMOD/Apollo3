/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/use-unknown-in-catch-callback-variable */

/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { DeleteUserChange, UserChange } from '@apollo-annotation/shared'
import { getRoot } from '@jbrowse/mobx-state-tree'
import DeleteIcon from '@mui/icons-material/Delete'
import {
  Box,
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  type SelectChangeEvent,
  Typography,
} from '@mui/material'
import {
  DataGrid,
  GridActionsCellItem,
  type GridCellParams,
  type GridColDef,
  type GridRowId,
  type GridRowModel,
  type GridRowParams,
  GridToolbar,
} from '@mui/x-data-grid'
import React, { useEffect, useState } from 'react'

import type { ApolloInternetAccountModel } from '../ApolloInternetAccount/model'
import type { ChangeManager } from '../ChangeManager'
import type { ApolloSessionModel } from '../session'
import { type ApolloRootModel, isApolloInternetAccount } from '../types'
import { createFetchErrorMessage } from '../util'

import { Dialog } from './Dialog'
import type {
  AssemblyPermissionResponse,
  AssemblyPermissionRow,
  AssemblyResponse,
} from './manageUsersAssemblyPermissions'
import {
  buildAssemblyPermissionRows,
  indexPermissionsByAssemblyId,
  normalizeAssemblyPermissionUpdate,
} from './manageUsersAssemblyPermissions'

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

export function ManageUsers({
  changeManager,
  handleClose,
  session,
}: ManageUsersProps) {
  const { internetAccounts } = getRoot<ApolloRootModel>(session)
  const apolloInternetAccounts: ApolloInternetAccountModel[] = internetAccounts
    .filter((ia: unknown) => isApolloInternetAccount(ia))
    .filter(
      (ia: ApolloInternetAccountModel & { role?: string }) =>
        ia.role?.includes('admin') ?? false,
    )
  if (apolloInternetAccounts.length === 0) {
    throw new Error('No Apollo internet account found')
  }
  const [errorMessage, setErrorMessage] = useState('')
  const [selectedInternetAccount, setSelectedInternetAccount] = useState(
    apolloInternetAccounts[0],
  )
  const [users, setUsers] = useState<UserResponse[]>([])
  const [assemblies, setAssemblies] = useState<AssemblyResponse[]>([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [assemblyPermissionsByAssemblyId, setAssemblyPermissionsByAssemblyId] =
    useState<Partial<Record<string, AssemblyPermissionResponse>>>({})

  useEffect(() => {
    async function getUsers() {
      const { baseURL } = selectedInternetAccount
      const usersUri = new URL('users', baseURL).href
      const assembliesUri = new URL('assemblies', baseURL).href
      const usersFetcher = selectedInternetAccount.getFetcher({
        locationType: 'UriLocation',
        uri: usersUri,
      })
      const assembliesFetcher = selectedInternetAccount.getFetcher({
        locationType: 'UriLocation',
        uri: assembliesUri,
      })
      const [usersResponse, assembliesResponse] = await Promise.all([
        usersFetcher(usersUri, { method: 'GET' }),
        assembliesFetcher(assembliesUri, { method: 'GET' }),
      ])
      if (!usersResponse.ok) {
        const newErrorMessage = await createFetchErrorMessage(
          usersResponse,
          'Error when getting user data from db',
        )
        throw new Error(newErrorMessage)
      }
      if (!assembliesResponse.ok) {
        const newErrorMessage = await createFetchErrorMessage(
          assembliesResponse,
          'Error when getting assemblies from db',
        )
        throw new Error(newErrorMessage)
      }
      const userData = (await usersResponse.json()) as UserResponse[]
      const assemblyData =
        (await assembliesResponse.json()) as AssemblyResponse[]
      const normalizedUsers = userData.map((u) =>
        u.role === undefined ? { ...u, role: '' } : u,
      )
      setUsers(normalizedUsers)
      setAssemblies(assemblyData)
      if (normalizedUsers[0]?._id) {
        setSelectedUserId(normalizedUsers[0]._id)
      }
    }
    getUsers().catch((error) => {
      setErrorMessage(String(error))
    })
  }, [selectedInternetAccount])

  useEffect(() => {
    async function getAssemblyPermissionsForUser() {
      if (!selectedUserId) {
        setAssemblyPermissionsByAssemblyId({})
        return
      }
      const { baseURL } = selectedInternetAccount
      const uri = new URL(
        `assemblyPermissions/byUser/${selectedUserId}`,
        baseURL,
      ).href
      const apolloFetch = selectedInternetAccount.getFetcher({
        locationType: 'UriLocation',
        uri,
      })
      const response = await apolloFetch(uri, { method: 'GET' })
      if (!response.ok) {
        const newErrorMessage = await createFetchErrorMessage(
          response,
          'Error when getting assembly permissions from db',
        )
        throw new Error(newErrorMessage)
      }
      const permissionData =
        (await response.json()) as AssemblyPermissionResponse[]
      setAssemblyPermissionsByAssemblyId(
        indexPermissionsByAssemblyId(permissionData),
      )
    }
    getAssemblyPermissionsForUser().catch((error) => {
      setErrorMessage(String(error))
    })
  }, [selectedInternetAccount, selectedUserId])

  async function deleteUser(id: GridRowId) {
    const change = new DeleteUserChange({
      typeName: 'DeleteUserChange',
      userId: id as string,
    })
    await changeManager.submit(change, {
      internetAccountId: selectedInternetAccount.internetAccountId,
    })
    setUsers((prevUsers: UserResponse[]) =>
      prevUsers.filter((row: UserResponse) => row._id !== id),
    )
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
      valueOptions: ['readOnly', 'user', 'admin', 'none'],
      getOptionLabel(value: string) {
        switch (value) {
          case 'readOnly': {
            return 'Read-only'
          }
          case 'user': {
            return 'User'
          }
          case 'admin': {
            return 'Admin'
          }
          case 'none': {
            return 'None'
          }
          default: {
            return 'unknown'
          }
        }
      },
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
            if (globalThis.confirm('Delete this user?')) {
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
      (ia) =>
        (ia as ApolloInternetAccountModel & { internetAccountId: string })
          .internetAccountId === e.target.value,
    )
    if (!newlySelectedInternetAccount) {
      throw new Error(
        `Could not find internetAccount with ID "${e.target.value}"`,
      )
    }
    setSelectedInternetAccount(newlySelectedInternetAccount)
  }

  function handleChangeManagedUser(e: SelectChangeEvent) {
    setSelectedUserId(e.target.value)
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

  async function processAssemblyPermissionRowUpdate(newRow: GridRowModel) {
    if (!selectedUserId) {
      return newRow
    }
    const { canViewAnnotations, canEditAnnotations } =
      normalizeAssemblyPermissionUpdate({
        canViewAnnotations: Boolean(newRow.canViewAnnotations),
        canEditAnnotations: Boolean(newRow.canEditAnnotations),
      })

    const { baseURL } = selectedInternetAccount
    const uri = new URL(
      `assemblyPermissions/${selectedUserId}/${newRow.assemblyId as string}`,
      baseURL,
    ).href
    const apolloFetch = selectedInternetAccount.getFetcher({
      locationType: 'UriLocation',
      uri,
    })
    const response = await apolloFetch(uri, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        canViewAnnotations,
        canEditAnnotations,
      }),
    })

    if (!response.ok) {
      const newErrorMessage = await createFetchErrorMessage(
        response,
        'Error when updating assembly permission',
      )
      throw new Error(newErrorMessage)
    }

    const savedPermission =
      (await response.json()) as AssemblyPermissionResponse
    setAssemblyPermissionsByAssemblyId(
      (prev: Partial<Record<string, AssemblyPermissionResponse>>) => ({
        ...prev,
        [savedPermission.assemblyId]: savedPermission,
      }),
    )

    return {
      ...newRow,
      canViewAnnotations,
      canEditAnnotations,
    }
  }

  const selectedManagedUser = users.find(
    (user: UserResponse) => user._id === selectedUserId,
  )

  const assemblyPermissionRows: AssemblyPermissionRow[] =
    buildAssemblyPermissionRows(assemblies, assemblyPermissionsByAssemblyId)

  const assemblyPermissionColumns: GridColDef[] = [
    {
      field: 'assemblyName',
      headerName: 'Assembly',
      width: 280,
      editable: false,
    },
    {
      field: 'canViewAnnotations',
      headerName: 'Can view annotations',
      width: 210,
      type: 'boolean',
      editable: true,
    },
    {
      field: 'canEditAnnotations',
      headerName: 'Can edit annotations',
      width: 210,
      type: 'boolean',
      editable: true,
    },
  ]

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
              {internetAccounts.map(
                (
                  option: ApolloInternetAccountModel & {
                    id: string
                    internetAccountId: string
                    name: string
                  },
                ) => (
                  <MenuItem key={option.id} value={option.internetAccountId}>
                    {option.name}
                  </MenuItem>
                ),
              )}
            </Select>
          </>
        ) : null}
        <div style={{ height: '100%', width: '100%' }}>
          <Typography variant="h6" sx={{ marginBottom: 1 }}>
            User roles
          </Typography>
          <DataGrid
            pagination
            rows={users}
            columns={gridColumns}
            getRowId={(row: UserResponse) => row._id}
            slots={{ toolbar: GridToolbar }}
            getRowHeight={() => 'auto'}
            isCellEditable={(params: GridCellParams) =>
              !isCurrentUser(params.id)
            }
            processRowUpdate={processRowUpdate}
            onProcessRowUpdateError={(error: unknown) => {
              setErrorMessage(String(error))
            }}
          />
        </div>

        <Box sx={{ marginTop: 4 }}>
          <Typography variant="h6" sx={{ marginBottom: 1 }}>
            Assembly permissions
          </Typography>
          <FormControl size="small" sx={{ minWidth: 320, marginBottom: 2 }}>
            <InputLabel id="managed-user-select-label">Managed user</InputLabel>
            <Select
              labelId="managed-user-select-label"
              value={selectedUserId}
              label="Managed user"
              onChange={handleChangeManagedUser}
            >
              {users.map((user: UserResponse) => (
                <MenuItem key={user._id} value={user._id}>
                  {`${user.username} (${user.email})`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {selectedManagedUser ? (
            <Typography variant="body2" sx={{ marginBottom: 1 }}>
              {`Managing assembly access for ${selectedManagedUser.username}`}
            </Typography>
          ) : null}
          <div style={{ height: 460, width: '100%' }}>
            <DataGrid
              rows={assemblyPermissionRows}
              columns={assemblyPermissionColumns}
              slots={{ toolbar: GridToolbar }}
              processRowUpdate={processAssemblyPermissionRowUpdate}
              onProcessRowUpdateError={(error: unknown) => {
                setErrorMessage(String(error))
              }}
              disableRowSelectionOnClick
            />
          </div>
        </Box>
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
