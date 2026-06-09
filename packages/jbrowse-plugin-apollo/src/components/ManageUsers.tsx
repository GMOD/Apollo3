/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/use-unknown-in-catch-callback-variable */

/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { DeleteUserChange, UserChange } from '@apollo-annotation/shared'
import { getRoot } from '@jbrowse/mobx-state-tree'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import DeleteIcon from '@mui/icons-material/Delete'
import HighlightOffIcon from '@mui/icons-material/HighlightOff'
import {
  Box,
  Button,
  Chip,
  DialogActions,
  DialogContent,
  DialogContentText,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  Tab,
  Tabs,
  type SelectChangeEvent,
  TextField,
  Typography,
} from '@mui/material'
import {
  DataGrid,
  GridActionsCellItem,
  type GridCellParams,
  type GridColDef,
  type GridRenderCellParams,
  type GridRowId,
  type GridRowModel,
  type GridRowParams,
  GridToolbar,
} from '@mui/x-data-grid'
import React, { useEffect, useMemo, useState } from 'react'

import type { ApolloInternetAccountModel } from '../ApolloInternetAccount/model'
import type { ChangeManager } from '../ChangeManager'
import type { ApolloSessionModel } from '../session'
import { type ApolloRootModel, isApolloInternetAccount } from '../types'
import { createFetchErrorMessage } from '../util'

import { Dialog } from './Dialog'
import { apolloDataGridSx } from './dataGridStyles'
import {
  type AssemblyPermissionResponse,
  type AssemblyPermissionRow,
  type AssemblyResponse,
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

interface GroupResponse {
  _id: string
  name: string
  description?: string
}

interface GroupMembershipResponse {
  _id?: string
  groupId: string
  userId: string
}

interface GroupAssemblyPermissionResponse {
  _id: string
  groupId: string
  assemblyId: string
  canViewAnnotations: boolean
  canEditAnnotations: boolean
}

interface GroupMembershipRow {
  id: string
  userId: string
  username: string
  email: string
  isMember: boolean
}

interface EffectiveAssemblyPermissionRow {
  id: string
  assemblyId: string
  assemblyName: string
  canViewAnnotations: boolean
  canEditAnnotations: boolean
  source: 'none' | 'direct' | 'group' | 'mixed'
}

interface EffectiveAssemblyPermissionResponse {
  _id: string
  userId: string
  assemblyId: string
  canViewAnnotations: boolean
  canEditAnnotations: boolean
  source: 'direct' | 'group' | 'mixed'
}

type PermissionView =
  | 'effective'
  | 'assembly'
  | 'groupMemberships'
  | 'groupPermissions'

type GroupPermissionView = 'current' | 'edit'

type GroupMembershipView = 'current' | 'edit'

type UserRoleOption = 'readOnly' | 'user' | 'admin' | 'none'

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
    .filter(isApolloInternetAccount)
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
  const [groups, setGroups] = useState<GroupResponse[]>([])
  const [groupFilterText, setGroupFilterText] = useState('')
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [permissionView, setPermissionView] =
    useState<PermissionView>('effective')
  const [groupMembershipView, setGroupMembershipView] =
    useState<GroupMembershipView>('edit')
  const [groupPermissionView, setGroupPermissionView] =
    useState<GroupPermissionView>('current')
  const [assemblyPermissionsByAssemblyId, setAssemblyPermissionsByAssemblyId] =
    useState<Partial<Record<string, AssemblyPermissionResponse>>>({})
  const [
    effectiveAssemblyPermissionsByAssemblyId,
    setEffectiveAssemblyPermissionsByAssemblyId,
  ] = useState<Partial<Record<string, EffectiveAssemblyPermissionResponse>>>({})
  const [groupMembershipByUserId, setGroupMembershipByUserId] = useState<
    Partial<Record<string, boolean>>
  >({})
  const [groupPermissionsByAssemblyId, setGroupPermissionsByAssemblyId] =
    useState<Partial<Record<string, GroupAssemblyPermissionResponse>>>({})
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupDescription, setNewGroupDescription] = useState('')
  const [localUserDialogOpen, setLocalUserDialogOpen] = useState(false)
  const [newLocalUsername, setNewLocalUsername] = useState('')
  const [newLocalEmail, setNewLocalEmail] = useState('')
  const [newLocalPassword, setNewLocalPassword] = useState('')
  const [newLocalRole, setNewLocalRole] = useState<UserRoleOption>('user')
  const [localUserErrorMessage, setLocalUserErrorMessage] = useState('')
  const [isCreatingLocalUser, setIsCreatingLocalUser] = useState(false)

  useEffect(() => {
    async function getUsers() {
      const { baseURL } = selectedInternetAccount
      const usersUri = new URL('users', baseURL).href
      const assembliesUri = new URL('assemblies', baseURL).href
      const groupsUri = new URL('assemblyPermissions/groups', baseURL).href
      const usersFetcher = selectedInternetAccount.getFetcher({
        locationType: 'UriLocation',
        uri: usersUri,
      })
      const assembliesFetcher = selectedInternetAccount.getFetcher({
        locationType: 'UriLocation',
        uri: assembliesUri,
      })
      const groupsFetcher = selectedInternetAccount.getFetcher({
        locationType: 'UriLocation',
        uri: groupsUri,
      })
      const [usersResponse, assembliesResponse, groupsResponse] =
        await Promise.all([
          usersFetcher(usersUri, { method: 'GET' }),
          assembliesFetcher(assembliesUri, { method: 'GET' }),
          groupsFetcher(groupsUri, { method: 'GET' }),
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
      if (!groupsResponse.ok) {
        const newErrorMessage = await createFetchErrorMessage(
          groupsResponse,
          'Error when getting groups from db',
        )
        throw new Error(newErrorMessage)
      }
      const userData = (await usersResponse.json()) as UserResponse[]
      const assemblyData =
        (await assembliesResponse.json()) as AssemblyResponse[]
      const groupData = (await groupsResponse.json()) as GroupResponse[]
      const normalizedUsers: UserResponse[] = userData.map((u) => ({
        ...u,
        role: u.role ?? '',
      }))
      setUsers(normalizedUsers)
      setAssemblies(assemblyData)
      setGroups(groupData.sort((a, b) => a.name.localeCompare(b.name)))
      if (normalizedUsers[0]?._id) {
        setSelectedUserId(normalizedUsers[0]._id)
      }
      if (groupData[0]?._id) {
        setSelectedGroupId(groupData[0]._id)
      } else {
        setSelectedGroupId('')
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

  useEffect(() => {
    async function getEffectiveAssemblyPermissionsForUser() {
      if (!selectedUserId) {
        setEffectiveAssemblyPermissionsByAssemblyId({})
        return
      }
      const { baseURL } = selectedInternetAccount
      const uri = new URL(
        `assemblyPermissions/effective/byUser/${selectedUserId}`,
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
          'Error when getting effective assembly permissions from db',
        )
        throw new Error(newErrorMessage)
      }
      const permissionData =
        (await response.json()) as EffectiveAssemblyPermissionResponse[]
      const byAssemblyId: Partial<
        Record<string, EffectiveAssemblyPermissionResponse>
      > = {}
      for (const permission of permissionData) {
        byAssemblyId[permission.assemblyId] = permission
      }
      setEffectiveAssemblyPermissionsByAssemblyId(byAssemblyId)
    }
    getEffectiveAssemblyPermissionsForUser().catch((error) => {
      setErrorMessage(String(error))
    })
  }, [selectedInternetAccount, selectedUserId])

  useEffect(() => {
    async function getMembershipsForGroup() {
      if (!selectedGroupId) {
        setGroupMembershipByUserId({})
        return
      }
      const { baseURL } = selectedInternetAccount
      const uri = new URL(
        `assemblyPermissions/groups/memberships/byGroup/${selectedGroupId}`,
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
          'Error when getting group memberships from db',
        )
        throw new Error(newErrorMessage)
      }
      const membershipData =
        (await response.json()) as GroupMembershipResponse[]
      const next: Partial<Record<string, boolean>> = {}
      for (const membership of membershipData) {
        next[membership.userId] = true
      }
      setGroupMembershipByUserId(next)
    }
    getMembershipsForGroup().catch((error) => {
      setErrorMessage(String(error))
    })
  }, [selectedGroupId, selectedInternetAccount])

  useEffect(() => {
    async function getAssemblyPermissionsForGroup() {
      if (!selectedGroupId) {
        setGroupPermissionsByAssemblyId({})
        return
      }
      const { baseURL } = selectedInternetAccount
      const uri = new URL(
        `assemblyPermissions/groups/permissions/${selectedGroupId}`,
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
          'Error when getting group assembly permissions from db',
        )
        throw new Error(newErrorMessage)
      }
      const permissionData =
        (await response.json()) as GroupAssemblyPermissionResponse[]
      const byAssemblyId: Partial<
        Record<string, GroupAssemblyPermissionResponse>
      > = {}
      for (const permission of permissionData) {
        byAssemblyId[permission.assemblyId] = permission
      }
      setGroupPermissionsByAssemblyId(byAssemblyId)
    }
    getAssemblyPermissionsForGroup().catch((error) => {
      setErrorMessage(String(error))
    })
  }, [selectedGroupId, selectedInternetAccount])

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

  async function createLocalUser() {
    const username = newLocalUsername.trim()
    const password = newLocalPassword.trim()
    const email = newLocalEmail.trim() || username

    if (!username || !password) {
      setLocalUserErrorMessage('Username and password are required.')
      return
    }

    setIsCreatingLocalUser(true)
    setLocalUserErrorMessage('')

    try {
      const { baseURL } = selectedInternetAccount
      const uri = new URL('users/local', baseURL).href
      const apolloFetch = selectedInternetAccount.getFetcher({
        locationType: 'UriLocation',
        uri,
      })
      const response = await apolloFetch(uri, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          email,
          password,
          role: newLocalRole === 'none' ? undefined : newLocalRole,
        }),
      })

      if (!response.ok) {
        const newErrorMessage = await createFetchErrorMessage(
          response,
          'Error when creating local user',
        )
        throw new Error(newErrorMessage)
      }

      const createdUser = (await response.json()) as UserResponse
      setUsers((prevUsers: UserResponse[]) => [...prevUsers, createdUser])
      setSelectedUserId(createdUser._id)
      setLocalUserDialogOpen(false)
      setNewLocalUsername('')
      setNewLocalEmail('')
      setNewLocalPassword('')
      setNewLocalRole('user')
      setLocalUserErrorMessage('')
    } catch (error) {
      const message = String(error)
      setLocalUserErrorMessage(message)
      setErrorMessage(message)
    } finally {
      setIsCreatingLocalUser(false)
    }
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
        const option = String(value)
        switch (option) {
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

  function handleChangeManagedGroup(e: SelectChangeEvent) {
    setSelectedGroupId(e.target.value)
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

  async function createGroup() {
    if (!newGroupName.trim()) {
      return
    }
    const { baseURL } = selectedInternetAccount
    const uri = new URL('assemblyPermissions/groups', baseURL).href
    const apolloFetch = selectedInternetAccount.getFetcher({
      locationType: 'UriLocation',
      uri,
    })
    const response = await apolloFetch(uri, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: newGroupName.trim(),
        description: newGroupDescription.trim() || undefined,
      }),
    })

    if (!response.ok) {
      const newErrorMessage = await createFetchErrorMessage(
        response,
        'Error when creating group',
      )
      throw new Error(newErrorMessage)
    }

    const createdGroup = (await response.json()) as GroupResponse
    setGroups((prevGroups: GroupResponse[]) =>
      [...prevGroups, createdGroup].sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    )
    setSelectedGroupId(createdGroup._id)
    setNewGroupName('')
    setNewGroupDescription('')
  }

  async function deleteSelectedGroup() {
    if (!selectedGroupId) {
      return
    }
    const groupToDelete = groups.find(
      (group: GroupResponse) => group._id === selectedGroupId,
    )
    if (!groupToDelete) {
      return
    }
    if (!globalThis.confirm(`Delete group "${groupToDelete.name}"?`)) {
      return
    }

    const { baseURL } = selectedInternetAccount
    const uri = new URL(
      `assemblyPermissions/groups/${selectedGroupId}`,
      baseURL,
    ).href
    const apolloFetch = selectedInternetAccount.getFetcher({
      locationType: 'UriLocation',
      uri,
    })
    const response = await apolloFetch(uri, { method: 'DELETE' })
    if (!response.ok) {
      const newErrorMessage = await createFetchErrorMessage(
        response,
        'Error when deleting group',
      )
      throw new Error(newErrorMessage)
    }

    const remainingGroups = groups.filter(
      (group: GroupResponse) => group._id !== selectedGroupId,
    )
    setGroups(remainingGroups)
    setSelectedGroupId(remainingGroups[0]?._id ?? '')
  }

  async function processGroupMembershipRowUpdate(newRow: GridRowModel) {
    if (!selectedGroupId) {
      return newRow
    }
    const userId = String(newRow.userId)
    const isMember = Boolean(newRow.isMember)
    const { baseURL } = selectedInternetAccount
    const uri = new URL(
      `assemblyPermissions/groups/memberships/${selectedGroupId}/${userId}`,
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
      body: JSON.stringify({ isMember }),
    })

    if (!response.ok) {
      const newErrorMessage = await createFetchErrorMessage(
        response,
        'Error when updating group membership',
      )
      throw new Error(newErrorMessage)
    }

    setGroupMembershipByUserId((prev: Partial<Record<string, boolean>>) => ({
      ...prev,
      [userId]: isMember,
    }))

    return {
      ...newRow,
      isMember,
    }
  }

  async function processGroupAssemblyPermissionRowUpdate(newRow: GridRowModel) {
    if (!selectedGroupId) {
      return newRow
    }
    const { canViewAnnotations, canEditAnnotations } =
      normalizeAssemblyPermissionUpdate({
        canViewAnnotations: Boolean(newRow.canViewAnnotations),
        canEditAnnotations: Boolean(newRow.canEditAnnotations),
      })

    const { baseURL } = selectedInternetAccount
    const uri = new URL(
      `assemblyPermissions/groups/permissions/${selectedGroupId}/${newRow.assemblyId as string}`,
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
        'Error when updating group assembly permission',
      )
      throw new Error(newErrorMessage)
    }

    const savedPermission =
      (await response.json()) as GroupAssemblyPermissionResponse
    setGroupPermissionsByAssemblyId(
      (prev: Partial<Record<string, GroupAssemblyPermissionResponse>>) => ({
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

  async function toggleAssemblyPermission(
    row: AssemblyPermissionRow,
    field: 'canViewAnnotations' | 'canEditAnnotations',
    checked: boolean,
  ) {
    await processAssemblyPermissionRowUpdate({
      ...row,
      [field]: checked,
    })
  }

  async function toggleGroupMembership(
    row: GroupMembershipRow,
    checked: boolean,
  ) {
    await processGroupMembershipRowUpdate({
      ...row,
      isMember: checked,
    })
  }

  async function toggleGroupAssemblyPermission(
    row: AssemblyPermissionRow,
    field: 'canViewAnnotations' | 'canEditAnnotations',
    checked: boolean,
  ) {
    await processGroupAssemblyPermissionRowUpdate({
      ...row,
      [field]: checked,
    })
  }

  function buildTogglePermissionColumn(
    field: 'canViewAnnotations' | 'canEditAnnotations',
    headerName: string,
    onToggle: (row: AssemblyPermissionRow, checked: boolean) => Promise<void>,
    disabled: (params: GridRenderCellParams<AssemblyPermissionRow>) => boolean,
  ): GridColDef<AssemblyPermissionRow> {
    return {
      field,
      headerName,
      width: 210,
      sortable: false,
      editable: false,
      renderCell: (params: GridRenderCellParams<AssemblyPermissionRow>) => (
        <Switch
          checked={Boolean(params.row[field])}
          disabled={disabled(params)}
          size="small"
          onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
            event.stopPropagation()
          }}
          onChange={(
            _event: React.ChangeEvent<HTMLInputElement>,
            checked: boolean,
          ) => {
            onToggle(params.row, checked).catch((error) => {
              setErrorMessage(String(error))
            })
          }}
        />
      ),
    }
  }

  function buildEffectivePermissionColumn(
    field: 'canViewAnnotations' | 'canEditAnnotations',
    headerName: string,
  ): GridColDef<EffectiveAssemblyPermissionRow> {
    return {
      field,
      headerName,
      width: 170,
      sortable: false,
      editable: false,
      renderCell: (
        params: GridRenderCellParams<EffectiveAssemblyPermissionRow>,
      ) => {
        const enabled = Boolean(params.row[field])
        return (
          <Chip
            size="small"
            icon={enabled ? <CheckCircleOutlineIcon /> : <HighlightOffIcon />}
            label={enabled ? 'Allowed' : 'No'}
            color={enabled ? 'success' : 'default'}
            variant={enabled ? 'filled' : 'outlined'}
            sx={{
              minWidth: 98,
              fontWeight: 700,
              '& .MuiChip-icon': {
                fontSize: '1rem',
              },
            }}
          />
        )
      },
    }
  }

  const selectedManagedUser = users.find(
    (user: UserResponse) => user._id === selectedUserId,
  )
  const selectedManagedGroup = groups.find(
    (group: GroupResponse) => group._id === selectedGroupId,
  )

  const filteredGroups = useMemo(() => {
    const query = groupFilterText.trim().toLowerCase()
    if (!query) {
      return groups
    }

    return groups.filter((group: GroupResponse) => {
      const haystack = `${group.name} ${group.description ?? ''}`.toLowerCase()
      return haystack.includes(query)
    })
  }, [groupFilterText, groups])

  const selectableGroups = useMemo(() => {
    if (!selectedManagedGroup) {
      return filteredGroups
    }
    if (
      filteredGroups.some(
        (group: GroupResponse) => group._id === selectedManagedGroup._id,
      )
    ) {
      return filteredGroups
    }
    return [selectedManagedGroup, ...filteredGroups]
  }, [filteredGroups, selectedManagedGroup])

  const assemblyPermissionRows: AssemblyPermissionRow[] =
    buildAssemblyPermissionRows(assemblies, assemblyPermissionsByAssemblyId)

  const effectiveAssemblyPermissionRows: EffectiveAssemblyPermissionRow[] =
    assemblies
      .map((assembly: AssemblyResponse) => {
        const permission =
          effectiveAssemblyPermissionsByAssemblyId[assembly._id]
        return {
          id: assembly._id,
          assemblyId: assembly._id,
          assemblyName: assembly.displayName ?? assembly.name,
          canViewAnnotations: permission?.canViewAnnotations ?? false,
          canEditAnnotations: permission?.canEditAnnotations ?? false,
          source: permission?.source ?? 'none',
        }
      })
      .sort(
        (
          a: EffectiveAssemblyPermissionRow,
          b: EffectiveAssemblyPermissionRow,
        ) => a.assemblyName.localeCompare(b.assemblyName),
      )

  const groupMembershipRows: GroupMembershipRow[] = users
    .map((user: UserResponse) => ({
      id: user._id,
      userId: user._id,
      username: user.username,
      email: user.email,
      isMember: Boolean(groupMembershipByUserId[user._id]),
    }))
    .sort((a: GroupMembershipRow, b: GroupMembershipRow) =>
      a.username.localeCompare(b.username),
    )

  const groupAssemblyPermissionRows: AssemblyPermissionRow[] =
    buildAssemblyPermissionRows(assemblies, groupPermissionsByAssemblyId).sort(
      (a: AssemblyPermissionRow, b: AssemblyPermissionRow) =>
        a.assemblyName.localeCompare(b.assemblyName),
    )

  const enabledGroupMembershipRows = groupMembershipRows.filter(
    (row: GroupMembershipRow) => row.isMember,
  )

  const enabledGroupAssemblyPermissionRows = groupAssemblyPermissionRows.filter(
    (row: AssemblyPermissionRow) =>
      row.canViewAnnotations || row.canEditAnnotations,
  )

  const groupSummary = selectedManagedGroup
    ? `${enabledGroupMembershipRows.length} members, ${enabledGroupAssemblyPermissionRows.length} assemblies with access`
    : 'Create or select a group to manage inherited access.'

  const assemblyPermissionColumns: GridColDef[] = [
    {
      field: 'assemblyName',
      headerName: 'Assembly',
      width: 280,
      editable: false,
    },
    buildTogglePermissionColumn(
      'canViewAnnotations',
      'Can view annotations',
      async (row, checked) => {
        await toggleAssemblyPermission(row, 'canViewAnnotations', checked)
      },
      () => !selectedUserId,
    ),
    buildTogglePermissionColumn(
      'canEditAnnotations',
      'Can edit annotations',
      async (row, checked) => {
        await toggleAssemblyPermission(row, 'canEditAnnotations', checked)
      },
      () => !selectedUserId,
    ),
  ]

  const effectiveAssemblyPermissionColumns: GridColDef[] = [
    {
      field: 'assemblyName',
      headerName: 'Assembly',
      width: 280,
      editable: false,
    },
    buildEffectivePermissionColumn('canViewAnnotations', 'Effective view'),
    buildEffectivePermissionColumn('canEditAnnotations', 'Effective edit'),
    {
      field: 'source',
      headerName: 'Source',
      width: 160,
      editable: false,
      type: 'singleSelect',
      valueOptions: ['none', 'direct', 'group', 'mixed'],
    },
  ]

  const groupMembershipColumns: GridColDef[] = [
    {
      field: 'username',
      headerName: 'User',
      width: 180,
      editable: false,
    },
    {
      field: 'email',
      headerName: 'Email',
      width: 240,
      editable: false,
    },
    {
      field: 'isMember',
      headerName: 'Member',
      width: 140,
      sortable: false,
      editable: false,
      renderCell: (params: GridRenderCellParams<GroupMembershipRow>) => (
        <Switch
          checked={Boolean(params.row.isMember)}
          disabled={!selectedGroupId}
          size="small"
          onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
            event.stopPropagation()
          }}
          onChange={(
            _event: React.ChangeEvent<HTMLInputElement>,
            checked: boolean,
          ) => {
            toggleGroupMembership(params.row, checked).catch((error) => {
              setErrorMessage(String(error))
            })
          }}
        />
      ),
    },
  ]

  const groupMembershipStateColumns: GridColDef[] = [
    {
      field: 'username',
      headerName: 'User',
      width: 180,
      editable: false,
    },
    {
      field: 'email',
      headerName: 'Email',
      width: 240,
      editable: false,
    },
  ]

  const groupManagementControls = (
    <>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          flexWrap: 'wrap',
          marginBottom: 2,
        }}
      >
        <TextField
          size="small"
          label="New group name"
          value={newGroupName}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            setNewGroupName(event.target.value)
          }}
        />
        <TextField
          size="small"
          label="Description (optional)"
          value={newGroupDescription}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            setNewGroupDescription(event.target.value)
          }}
        />
        <Button
          variant="contained"
          onClick={() => {
            createGroup().catch((error) => {
              setErrorMessage(String(error))
            })
          }}
        >
          Add group
        </Button>
        <Button
          variant="outlined"
          color="error"
          disabled={!selectedGroupId}
          onClick={() => {
            deleteSelectedGroup().catch((error) => {
              setErrorMessage(String(error))
            })
          }}
        >
          Delete selected group
        </Button>
      </Box>

      <TextField
        size="small"
        label="Filter groups"
        placeholder="Type part of a group name, e.g. amel"
        value={groupFilterText}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
          setGroupFilterText(event.target.value)
        }}
        sx={{ minWidth: 320, marginBottom: 1 }}
      />

      <FormControl size="small" sx={{ minWidth: 320, marginBottom: 1 }}>
        <InputLabel id="managed-group-select-label">Managed group</InputLabel>
        <Select
          labelId="managed-group-select-label"
          value={selectedGroupId}
          label="Managed group"
          onChange={handleChangeManagedGroup}
        >
          {selectableGroups.map((group: GroupResponse) => (
            <MenuItem key={group._id} value={group._id}>
              {group.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      {selectedManagedGroup ? (
        <Typography variant="body2" sx={{ marginBottom: 1 }}>
          {`Managing ${selectedManagedGroup.name}: ${groupSummary}`}
        </Typography>
      ) : (
        <Typography variant="body2" sx={{ marginBottom: 1 }}>
          {groupSummary}
        </Typography>
      )}
      {groupFilterText ? (
        <Typography variant="body2" sx={{ marginBottom: 1 }}>
          {`${filteredGroups.length} groups match "${groupFilterText.trim()}".`}
        </Typography>
      ) : null}
    </>
  )

  const groupAssemblyPermissionColumns: GridColDef[] = [
    {
      field: 'assemblyName',
      headerName: 'Assembly',
      width: 280,
      editable: false,
    },
    buildTogglePermissionColumn(
      'canViewAnnotations',
      'Can view annotations',
      async (row, checked) => {
        await toggleGroupAssemblyPermission(row, 'canViewAnnotations', checked)
      },
      () => !selectedGroupId,
    ),
    buildTogglePermissionColumn(
      'canEditAnnotations',
      'Can edit annotations',
      async (row, checked) => {
        await toggleGroupAssemblyPermission(row, 'canEditAnnotations', checked)
      },
      () => !selectedGroupId,
    ),
  ]

  const groupAssemblyPermissionStateColumns: GridColDef[] = [
    {
      field: 'assemblyName',
      headerName: 'Assembly',
      width: 280,
      editable: false,
    },
    buildEffectivePermissionColumn('canViewAnnotations', 'View enabled'),
    buildEffectivePermissionColumn('canEditAnnotations', 'Edit enabled'),
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
              {apolloInternetAccounts.map(
                (option: ApolloInternetAccountModel) => (
                  <MenuItem
                    key={String(
                      (option as ApolloInternetAccountModel & { id: string })
                        .id,
                    )}
                    value={String(
                      (
                        option as ApolloInternetAccountModel & {
                          internetAccountId: string
                        }
                      ).internetAccountId,
                    )}
                  >
                    {
                      (option as ApolloInternetAccountModel & { name: string })
                        .name
                    }
                  </MenuItem>
                ),
              )}
            </Select>
          </>
        ) : null}
        <div style={{ height: '100%', width: '100%' }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 1,
            }}
          >
            <Typography variant="h6">User roles</Typography>
            <Button
              variant="contained"
              onClick={() => {
                setLocalUserErrorMessage('')
                setLocalUserDialogOpen(true)
              }}
            >
              Add local user
            </Button>
          </Box>
          <DataGrid
            pagination
            rows={users}
            columns={gridColumns}
            getRowId={(row: UserResponse) => row._id}
            slots={{ toolbar: GridToolbar }}
            sx={apolloDataGridSx}
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
            Permission management
          </Typography>
          <Tabs
            value={permissionView}
            onChange={(_event: React.SyntheticEvent, value: PermissionView) => {
              setPermissionView(value)
            }}
            sx={{ marginBottom: 2 }}
          >
            <Tab value="effective" label="Effective access" />
            <Tab value="assembly" label="Assembly permissions" />
            <Tab value="groupMemberships" label="Group memberships" />
            <Tab value="groupPermissions" label="Group permissions" />
          </Tabs>

          {permissionView === 'effective' || permissionView === 'assembly' ? (
            <FormControl size="small" sx={{ minWidth: 320, marginBottom: 2 }}>
              <InputLabel id="managed-user-select-label">
                Managed user
              </InputLabel>
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
          ) : null}

          {permissionView === 'effective' ? (
            <>
              {selectedManagedUser ? (
                <Typography variant="body2" sx={{ marginBottom: 1 }}>
                  {`Effective access for ${selectedManagedUser.username}`}
                </Typography>
              ) : null}
              <div style={{ height: 460, width: '100%' }}>
                <DataGrid
                  rows={effectiveAssemblyPermissionRows}
                  columns={effectiveAssemblyPermissionColumns}
                  slots={{ toolbar: GridToolbar }}
                  sx={apolloDataGridSx}
                  disableRowSelectionOnClick
                />
              </div>
            </>
          ) : null}

          {permissionView === 'assembly' ? (
            <>
              {selectedManagedUser ? (
                <Typography variant="body2" sx={{ marginBottom: 1 }}>
                  {`Editing direct user access for ${selectedManagedUser.username}`}
                </Typography>
              ) : null}
              <div style={{ height: 460, width: '100%' }}>
                <DataGrid
                  rows={assemblyPermissionRows}
                  columns={assemblyPermissionColumns}
                  slots={{ toolbar: GridToolbar }}
                  sx={apolloDataGridSx}
                  processRowUpdate={processAssemblyPermissionRowUpdate}
                  onProcessRowUpdateError={(error: unknown) => {
                    setErrorMessage(String(error))
                  }}
                  disableRowSelectionOnClick
                />
              </div>
            </>
          ) : null}

          {permissionView === 'groupMemberships' ? (
            <>
              <Typography variant="h6" sx={{ marginBottom: 1, marginTop: 1 }}>
                Group memberships
              </Typography>
              {groupManagementControls}

              <Tabs
                value={groupMembershipView}
                onChange={(
                  _event: React.SyntheticEvent,
                  value: GroupMembershipView,
                ) => {
                  setGroupMembershipView(value)
                }}
                sx={{ marginBottom: 2 }}
              >
                <Tab value="current" label="Current state" />
                <Tab value="edit" label="Edit memberships" />
              </Tabs>

              {groupMembershipView === 'current' ? (
                <>
                  <Typography variant="body2" sx={{ marginBottom: 2 }}>
                    {selectedManagedGroup
                      ? `${enabledGroupMembershipRows.length} users are currently members of this group.`
                      : 'Select a group to review its current memberships.'}
                  </Typography>

                  <Typography variant="subtitle1" sx={{ marginBottom: 1 }}>
                    Active group memberships
                  </Typography>
                  {enabledGroupMembershipRows.length ? (
                    <div
                      style={{ height: 320, width: '100%', marginBottom: 24 }}
                    >
                      <DataGrid
                        rows={enabledGroupMembershipRows}
                        columns={groupMembershipStateColumns}
                        slots={{ toolbar: GridToolbar }}
                        sx={apolloDataGridSx}
                        disableRowSelectionOnClick
                      />
                    </div>
                  ) : (
                    <Typography variant="body2" sx={{ marginBottom: 3 }}>
                      No users are currently members of this group.
                    </Typography>
                  )}
                </>
              ) : null}

              {groupMembershipView === 'edit' ? (
                <>
                  <Typography variant="body2" sx={{ marginBottom: 2 }}>
                    Toggle group membership here. Changes are saved row by row.
                  </Typography>

                  <Typography variant="subtitle1" sx={{ marginBottom: 1 }}>
                    Group memberships
                  </Typography>
                  <div style={{ height: 360, width: '100%', marginBottom: 24 }}>
                    <DataGrid
                      rows={groupMembershipRows}
                      columns={groupMembershipColumns}
                      slots={{ toolbar: GridToolbar }}
                      sx={apolloDataGridSx}
                      processRowUpdate={processGroupMembershipRowUpdate}
                      onProcessRowUpdateError={(error: unknown) => {
                        setErrorMessage(String(error))
                      }}
                      disableRowSelectionOnClick
                      isCellEditable={(params: GridCellParams) =>
                        Boolean(selectedGroupId) && params.field === 'isMember'
                      }
                    />
                  </div>
                </>
              ) : null}
            </>
          ) : null}

          {permissionView === 'groupPermissions' ? (
            <>
              <Typography variant="h6" sx={{ marginBottom: 1, marginTop: 1 }}>
                Group permissions
              </Typography>
              {groupManagementControls}

              <Tabs
                value={groupPermissionView}
                onChange={(
                  _event: React.SyntheticEvent,
                  value: GroupPermissionView,
                ) => {
                  setGroupPermissionView(value)
                }}
                sx={{ marginBottom: 2 }}
              >
                <Tab value="current" label="Current state" />
                <Tab value="edit" label="Edit permissions" />
              </Tabs>

              {groupPermissionView === 'current' ? (
                <>
                  <Typography variant="body2" sx={{ marginBottom: 2 }}>
                    {selectedManagedGroup
                      ? `${enabledGroupAssemblyPermissionRows.length} assemblies currently have inherited access in this group.`
                      : 'Select a group to review its current assembly permissions.'}
                  </Typography>

                  <Typography variant="subtitle1" sx={{ marginBottom: 1 }}>
                    Enabled assembly permissions
                  </Typography>
                  {enabledGroupAssemblyPermissionRows.length ? (
                    <div style={{ height: 360, width: '100%' }}>
                      <DataGrid
                        rows={enabledGroupAssemblyPermissionRows}
                        columns={groupAssemblyPermissionStateColumns}
                        slots={{ toolbar: GridToolbar }}
                        sx={apolloDataGridSx}
                        disableRowSelectionOnClick
                      />
                    </div>
                  ) : (
                    <Typography variant="body2">
                      No assembly permissions are currently enabled for this
                      group.
                    </Typography>
                  )}
                </>
              ) : null}

              {groupPermissionView === 'edit' ? (
                <>
                  <Typography variant="body2" sx={{ marginBottom: 2 }}>
                    Toggle group assembly access here. Changes are saved row by
                    row.
                  </Typography>

                  <Typography variant="subtitle1" sx={{ marginBottom: 1 }}>
                    Group assembly permissions
                  </Typography>
                  <div style={{ height: 420, width: '100%' }}>
                    <DataGrid
                      rows={groupAssemblyPermissionRows}
                      columns={groupAssemblyPermissionColumns}
                      slots={{ toolbar: GridToolbar }}
                      sx={apolloDataGridSx}
                      processRowUpdate={processGroupAssemblyPermissionRowUpdate}
                      onProcessRowUpdateError={(error: unknown) => {
                        setErrorMessage(String(error))
                      }}
                      disableRowSelectionOnClick
                      isCellEditable={(params: GridCellParams) =>
                        Boolean(selectedGroupId) &&
                        (params.field === 'canViewAnnotations' ||
                          params.field === 'canEditAnnotations')
                      }
                    />
                  </div>
                </>
              ) : null}
            </>
          ) : null}
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
      {localUserDialogOpen ? (
        <Dialog
          open
          title="Add local user"
          handleClose={() => {
            setLocalUserErrorMessage('')
            setLocalUserDialogOpen(false)
          }}
          maxWidth="sm"
        >
          <DialogContent
            sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
          >
            <TextField
              label="Username"
              value={newLocalUsername}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                setNewLocalUsername(event.target.value)
              }}
            />
            <TextField
              label="Email"
              value={newLocalEmail}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                setNewLocalEmail(event.target.value)
              }}
            />
            <TextField
              label="Password"
              type="password"
              value={newLocalPassword}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                setNewLocalPassword(event.target.value)
              }}
            />
            <FormControl>
              <InputLabel id="new-local-role-label">Role</InputLabel>
              <Select
                labelId="new-local-role-label"
                value={newLocalRole}
                label="Role"
                onChange={(event: SelectChangeEvent) => {
                  setNewLocalRole(event.target.value as UserRoleOption)
                }}
              >
                <MenuItem value="readOnly">Read-only</MenuItem>
                <MenuItem value="user">User</MenuItem>
                <MenuItem value="admin">Admin</MenuItem>
                <MenuItem value="none">None</MenuItem>
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions>
            <Button
              variant="outlined"
              onClick={() => {
                setLocalUserErrorMessage('')
                setLocalUserDialogOpen(false)
              }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              disabled={isCreatingLocalUser}
              onClick={() => {
                createLocalUser().catch(() => {
                  // errors are handled in createLocalUser
                })
              }}
            >
              {isCreatingLocalUser ? 'Creating...' : 'Create user'}
            </Button>
          </DialogActions>
          {localUserErrorMessage ? (
            <DialogContent sx={{ pt: 0 }}>
              <DialogContentText color="error">
                {localUserErrorMessage}
              </DialogContentText>
            </DialogContent>
          ) : null}
        </Dialog>
      ) : null}
    </Dialog>
  )
}
