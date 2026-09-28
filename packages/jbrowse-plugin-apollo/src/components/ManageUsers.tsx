/* eslint-disable @typescript-eslint/unbound-method */
import {
  AddUserChange,
  DeleteUserChange,
  UserChange,
} from '@apollo-annotation/shared'
import { getSession } from '@jbrowse/core/util'
import { getRoot } from '@jbrowse/mobx-state-tree'
import DeleteIcon from '@mui/icons-material/Delete'
import PersonAddIcon from '@mui/icons-material/PersonAdd'
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog as MuiDialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  type SelectChangeEvent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import {
  DataGrid,
  GridActionsCellItem,
  type GridColDef,
  type GridFilterModel,
  type GridPaginationModel,
  type GridSortModel,
} from '@mui/x-data-grid'
import React, { useEffect, useState } from 'react'

import type { ApolloInternetAccountModel } from '../ApolloInternetAccount/model'
import type { ChangeManager } from '../ChangeManager'
import type { ApolloSessionModel } from '../session'
import { type ApolloRootModel, isApolloInternetAccount } from '../types'
import { createFetchErrorMessage } from '../util'

import { Dialog } from './Dialog'

type UserRole = 'admin' | 'user' | 'readOnly' | 'none'

const roleLabels: Record<UserRole, string> = {
  readOnly: 'Read-only',
  user: 'User',
  admin: 'Admin',
  none: 'None',
}

const roles = Object.keys(roleLabels) as UserRole[]

interface UserResponse {
  _id: string
  /** Not set for users who have been added but haven't logged in yet */
  username?: string
  email: string
  role?: UserRole | ''
  createdAt?: string
  special?: 'guest' | 'root'
}

interface UserRow extends UserResponse {
  role: UserRole
}

interface UsersPageResponse {
  users: UserResponse[]
  totalCount: number
  specialUsers: UserResponse[]
}

const specialUserDescriptions: Record<
  NonNullable<UserResponse['special']>,
  { label: string; description: string }
> = {
  guest: {
    label: 'Guest',
    description: 'Used by anyone logged in as guest.',
  },
  root: {
    label: 'Root',
    description:
      'Used when logging in as the root user from the CLI. Always has the admin role.',
  },
}

function toUserRow(user: UserResponse): UserRow {
  return { ...user, role: isRole(user.role) ? user.role : 'none' }
}

function isRole(value: unknown): value is UserRole {
  return typeof value === 'string' && value in roleLabels
}

/** Name to show for a user, using the email if they haven't logged in yet */
function getDisplayName(user: UserResponse) {
  return user.username ?? user.email
}

async function apolloFetch(
  internetAccount: ApolloInternetAccountModel,
  path: string,
  init?: RequestInit,
) {
  const uri = new URL(path, internetAccount.baseURL).href
  const fetcher = internetAccount.getFetcher({
    locationType: 'UriLocation',
    uri,
  })
  return fetcher(uri, { method: 'GET', ...init })
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
    .filter((ia) => isApolloInternetAccount(ia))
    .filter((ia) => ia.role?.includes('admin'))
  const [errorMessage, setErrorMessage] = useState('')
  const [selectedInternetAccountId, setSelectedInternetAccountId] = useState(
    apolloInternetAccounts.at(0)?.internetAccountId,
  )
  const [users, setUsers] = useState<UserRow[]>([])
  const [specialUsers, setSpecialUsers] = useState<UserRow[]>([])
  const [rowCount, setRowCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 25,
  })
  const [sortModel, setSortModel] = useState<GridSortModel>([
    { field: 'username', sort: 'asc' },
  ])
  const [filterModel, setFilterModel] = useState<GridFilterModel>({
    items: [],
  })
  // Incrementing this triggers a re-fetch of the current page
  const [refreshCount, setRefreshCount] = useState(0)
  const [userToDelete, setUserToDelete] = useState<UserRow>()
  const [addUserOpen, setAddUserOpen] = useState(false)
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserRole, setNewUserRole] = useState<UserRole>('user')
  const [addingUser, setAddingUser] = useState(false)
  // IDs of users with a change in progress
  const [pendingUserIds, setPendingUserIds] = useState<string[]>([])

  const selectedInternetAccount = apolloInternetAccounts.find(
    (ia) => ia.internetAccountId === selectedInternetAccountId,
  )

  useEffect(() => {
    if (!selectedInternetAccount) {
      return
    }
    const controller = new AbortController()
    async function getUsers(internetAccount: ApolloInternetAccountModel) {
      setLoading(true)
      const params = new URLSearchParams({
        page: String(paginationModel.page),
        pageSize: String(paginationModel.pageSize),
      })
      const sortEntry = sortModel.at(0)
      if (sortEntry?.sort) {
        params.set('sortField', sortEntry.field)
        params.set('sortOrder', sortEntry.sort)
      }
      const search = filterModel.quickFilterValues?.join(' ').trim()
      if (search) {
        params.set('search', search)
      }
      const roleFilter = filterModel.items.find((item) => item.field === 'role')
      if (roleFilter) {
        // "isAnyOf" has an array value, "is" and "not" have a single value
        const values: unknown[] = Array.isArray(roleFilter.value)
          ? roleFilter.value
          : [roleFilter.value]
        const filterRoles = values.filter((value) => isRole(value))
        if (filterRoles.length > 0) {
          params.set('role', filterRoles.join(','))
          params.set(
            'roleOperator',
            roleFilter.operator === 'not' ? 'notIn' : 'in',
          )
        }
      }
      const response = await apolloFetch(
        internetAccount,
        `users?${params.toString()}`,
        { signal: controller.signal },
      )
      if (!response.ok) {
        setErrorMessage(
          await createFetchErrorMessage(
            response,
            'Error when getting user data from db',
          ),
        )
        return
      }
      const data = (await response.json()) as UsersPageResponse
      if (controller.signal.aborted) {
        return
      }
      setUsers(data.users.map((u) => toUserRow(u)))
      setSpecialUsers(data.specialUsers.map((u) => toUserRow(u)))
      setRowCount(data.totalCount)
      setErrorMessage('')
      // If this page is past the end (e.g. after deleting the last user on
      // the last page), step back a page
      if (data.users.length === 0 && paginationModel.page > 0) {
        setPaginationModel((model) => ({
          ...model,
          page: Math.max(Math.ceil(data.totalCount / model.pageSize) - 1, 0),
        }))
      }
    }
    getUsers(selectedInternetAccount)
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setErrorMessage(String(error))
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      })
    return () => {
      controller.abort()
    }
  }, [
    selectedInternetAccount,
    paginationModel,
    sortModel,
    filterModel,
    refreshCount,
  ])

  if (!selectedInternetAccount) {
    return (
      <Dialog
        open
        title="Manage users"
        handleClose={handleClose}
        data-testid="manage-users"
      >
        <DialogContent>
          <Alert severity="error">
            No Apollo account with the admin role was found
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={handleClose}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    )
  }
  const internetAccount = selectedInternetAccount

  /** Get a user from the server, or undefined if the user doesn't exist */
  async function fetchUser(userId: string) {
    const response = await apolloFetch(internetAccount, `users/${userId}`)
    if (!response.ok) {
      throw new Error(
        await createFetchErrorMessage(response, 'Error when getting user'),
      )
    }
    const text = await response.text()
    return text ? toUserRow(JSON.parse(text) as UserResponse) : undefined
  }

  /**
   * Run a user change. `ChangeManager.submit` reports its own errors and
   * doesn't throw, so `checkSucceeded` asks the server whether it worked.
   */
  async function runUserChange(
    user: UserRow,
    change: UserChange | DeleteUserChange,
    checkSucceeded: (updatedUser?: UserRow) => boolean,
    successMessage: string,
  ) {
    setPendingUserIds((ids) => [...ids, user._id])
    try {
      await changeManager.submit(change, {
        internetAccountId: internetAccount.internetAccountId,
        addToRecents: false,
      })
      if (checkSucceeded(await fetchUser(user._id))) {
        getSession(session).notify(successMessage, 'success')
      }
    } catch (error) {
      setErrorMessage(String(error))
    } finally {
      setPendingUserIds((ids) => ids.filter((id) => id !== user._id))
      setRefreshCount((count) => count + 1)
    }
  }

  async function changeRole(user: UserRow, role: UserRole) {
    if (role === user.role) {
      return
    }
    const change = new UserChange({
      typeName: 'UserChange',
      role,
      userId: user._id,
    })
    await runUserChange(
      user,
      change,
      (updatedUser) => updatedUser?.role === role,
      `Changed role of "${getDisplayName(user)}" to ${roleLabels[role]}`,
    )
  }

  async function deleteUser(user: UserRow) {
    const change = new DeleteUserChange({
      typeName: 'DeleteUserChange',
      userId: user._id,
    })
    await runUserChange(
      user,
      change,
      (updatedUser) => !updatedUser,
      `Deleted user "${getDisplayName(user)}"`,
    )
  }

  /** Get a user from the server by email, or undefined if not found */
  async function fetchUserByEmail(email: string) {
    const params = new URLSearchParams({
      page: '0',
      pageSize: '10',
      search: email,
    })
    const response = await apolloFetch(
      internetAccount,
      `users?${params.toString()}`,
    )
    if (!response.ok) {
      throw new Error(
        await createFetchErrorMessage(response, 'Error when getting user'),
      )
    }
    const data = (await response.json()) as UsersPageResponse
    return data.users.find(
      (user) => user.email.toLowerCase() === email.toLowerCase(),
    )
  }

  async function addUser(email: string, role: UserRole) {
    const change = new AddUserChange({ typeName: 'AddUserChange', email, role })
    setAddingUser(true)
    try {
      await changeManager.submit(change, {
        internetAccountId: internetAccount.internetAccountId,
        addToRecents: false,
      })
      if (await fetchUserByEmail(email)) {
        getSession(session).notify(
          `Added "${email}" with role ${roleLabels[role]}`,
          'success',
        )
        setAddUserOpen(false)
        setNewUserEmail('')
        setNewUserRole('user')
      }
    } catch (error) {
      setErrorMessage(String(error))
    } finally {
      setAddingUser(false)
      setRefreshCount((count) => count + 1)
    }
  }

  function isCurrentUser(user: UserRow) {
    return user._id === internetAccount.getUserId()
  }

  function canEditRole(user: UserRow) {
    return (
      !isCurrentUser(user) &&
      user.special !== 'root' &&
      !pendingUserIds.includes(user._id)
    )
  }

  function canDelete(user: UserRow) {
    return (
      !isCurrentUser(user) &&
      !user.special &&
      !pendingUserIds.includes(user._id)
    )
  }

  function renderRoleSelect(user: UserRow) {
    return (
      <Select
        size="small"
        variant="standard"
        disableUnderline
        value={user.role}
        disabled={!canEditRole(user)}
        onChange={(event: SelectChangeEvent) => {
          const { value } = event.target
          if (isRole(value)) {
            void changeRole(user, value)
          }
        }}
        // Keep the grid from treating keystrokes in the select as navigation
        onKeyDown={(event) => {
          event.stopPropagation()
        }}
        inputProps={{ 'aria-label': `Role for ${getDisplayName(user)}` }}
        sx={{ fontSize: 'inherit', width: '100%' }}
      >
        {roles.map((role) => (
          <MenuItem key={role} value={role}>
            {roleLabels[role]}
          </MenuItem>
        ))}
      </Select>
    )
  }

  function renderUsername(user: UserRow) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {user.username ?? (
          <Chip label="Pending first login" size="small" variant="outlined" />
        )}
        {isCurrentUser(user) ? (
          <Chip label="You" size="small" color="primary" variant="outlined" />
        ) : null}
      </Box>
    )
  }

  const gridColumns: GridColDef<UserRow>[] = [
    {
      field: 'username',
      headerName: 'User',
      flex: 1,
      minWidth: 140,
      filterable: false,
      renderCell: ({ row }) => renderUsername(row),
    },
    {
      field: 'email',
      headerName: 'Email',
      flex: 1.5,
      minWidth: 180,
      filterable: false,
    },
    {
      field: 'role',
      headerName: 'Role',
      width: 150,
      type: 'singleSelect',
      valueOptions: roles.map((role) => ({
        value: role,
        label: roleLabels[role],
      })),
      renderCell: ({ row }) => renderRoleSelect(row),
    },
    {
      field: 'createdAt',
      headerName: 'Created',
      width: 180,
      type: 'dateTime',
      filterable: false,
      valueGetter: (value?: string) => (value ? new Date(value) : undefined),
    },
    {
      field: 'actions',
      type: 'actions',
      getActions: ({ row }) => [
        <GridActionsCellItem
          key={`delete-${row._id}`}
          icon={<DeleteIcon />}
          onClick={() => {
            setUserToDelete(row)
          }}
          disabled={!canDelete(row)}
          label="Delete"
        />,
      ],
    },
  ]

  function handleChangeInternetAccount(e: SelectChangeEvent) {
    setUsers([])
    setSpecialUsers([])
    setRowCount(0)
    setErrorMessage('')
    setPaginationModel((model) => ({ ...model, page: 0 }))
    setSelectedInternetAccountId(e.target.value)
  }

  return (
    <Dialog
      open
      fullScreen
      title="Manage users"
      handleClose={handleClose}
      data-testid="manage-users"
    >
      <DialogContent
        sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}
      >
        {errorMessage ? (
          <Alert
            severity="error"
            onClose={() => {
              setErrorMessage('')
            }}
          >
            {errorMessage}
          </Alert>
        ) : null}
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {apolloInternetAccounts.length > 1 ? (
            <FormControl size="small" sx={{ minWidth: 240 }}>
              <InputLabel id="manage-users-account-label">Account</InputLabel>
              <Select
                labelId="manage-users-account-label"
                label="Account"
                value={internetAccount.internetAccountId}
                onChange={handleChangeInternetAccount}
              >
                {apolloInternetAccounts.map((ia) => (
                  <MenuItem
                    key={ia.internetAccountId}
                    value={ia.internetAccountId}
                  >
                    {ia.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          ) : null}
          <Button
            variant="contained"
            startIcon={<PersonAddIcon />}
            onClick={() => {
              setAddUserOpen(true)
            }}
          >
            Add user
          </Button>
        </Box>
        {specialUsers.length > 0 ? (
          <Box>
            <Typography variant="h6" gutterBottom>
              System accounts
            </Typography>
            <TableContainer
              sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}
            >
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Account</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell sx={{ width: 150 }}>Role</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {specialUsers.map((user) => {
                    if (!user.special) {
                      return null
                    }
                    const { description, label } =
                      specialUserDescriptions[user.special]
                    return (
                      <TableRow key={user._id}>
                        <TableCell>
                          <Chip label={label} size="small" />
                        </TableCell>
                        <TableCell>{description}</TableCell>
                        <TableCell>{renderRoleSelect(user)}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        ) : null}
        <Box sx={{ flex: 1, minHeight: 300 }}>
          {specialUsers.length > 0 ? (
            <Typography variant="h6" gutterBottom>
              Users
            </Typography>
          ) : null}
          <DataGrid
            pagination
            paginationMode="server"
            sortingMode="server"
            filterMode="server"
            rowCount={rowCount}
            paginationModel={paginationModel}
            onPaginationModelChange={setPaginationModel}
            sortModel={sortModel}
            onSortModelChange={setSortModel}
            filterModel={filterModel}
            onFilterModelChange={(model) => {
              setFilterModel(model)
              setPaginationModel((m) => ({ ...m, page: 0 }))
            }}
            pageSizeOptions={[10, 25, 50, 100]}
            loading={loading}
            rows={users}
            columns={gridColumns}
            getRowId={(row) => row._id}
            showToolbar
            disableRowSelectionOnClick
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={handleClose}>
          Close
        </Button>
      </DialogActions>
      <MuiDialog
        open={Boolean(userToDelete)}
        onClose={() => {
          setUserToDelete(undefined)
        }}
      >
        <DialogTitle>Delete user?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Delete user{' '}
            <strong>{userToDelete ? getDisplayName(userToDelete) : ''}</strong>{' '}
            ({userToDelete?.email})? This cannot be undone. Depending on the
            server&apos;s settings, they may be able to log in again and be
            re-created with the default role.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setUserToDelete(undefined)
            }}
          >
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              if (userToDelete) {
                void deleteUser(userToDelete)
              }
              setUserToDelete(undefined)
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </MuiDialog>
      <MuiDialog
        open={addUserOpen}
        onClose={() => {
          setAddUserOpen(false)
        }}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void addUser(newUserEmail.trim(), newUserRole)
          }}
        >
          <DialogTitle>Add user</DialogTitle>
          <DialogContent
            sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
          >
            <DialogContentText>
              Add a user by email who has not yet logged in.
            </DialogContentText>
            <TextField
              required
              type="email"
              label="Email"
              value={newUserEmail}
              onChange={(event) => {
                setNewUserEmail(event.target.value)
              }}
              variant="outlined"
            />
            <FormControl>
              <InputLabel id="add-user-role-label">Role</InputLabel>
              <Select
                labelId="add-user-role-label"
                label="Role"
                value={newUserRole}
                onChange={(event: SelectChangeEvent) => {
                  const { value } = event.target
                  if (isRole(value)) {
                    setNewUserRole(value)
                  }
                }}
              >
                {roles.map((role) => (
                  <MenuItem key={role} value={role}>
                    {roleLabels[role]}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                setAddUserOpen(false)
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={addingUser || !newUserEmail.trim()}
            >
              Add
            </Button>
          </DialogActions>
        </form>
      </MuiDialog>
    </Dialog>
  )
}
