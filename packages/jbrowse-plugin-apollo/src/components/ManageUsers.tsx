/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/use-unknown-in-catch-callback-variable */
/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { DeleteUserChange, UserChange } from '@apollo-annotation/shared'
import { readConfObject } from '@jbrowse/core/configuration'
import DeleteIcon from '@mui/icons-material/Delete'
import {
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
} from '@mui/material'
import {
  DataGrid,
  GridActionsCellItem,
  type GridCellParams,
  type GridColDef,
  type GridRowId,
  type GridRowModel,
  type GridRowParams,
} from '@mui/x-data-grid'
import React, { useEffect, useState } from 'react'

import type { ChangeManager } from '../ChangeManager'
import type { ApolloSessionModel } from '../session'
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

export function ManageUsers({
  changeManager,
  handleClose,
  session,
}: ManageUsersProps) {
  const [errorMessage, setErrorMessage] = useState('')
  const [users, setUsers] = useState<UserResponse[]>([])

  useEffect(() => {
    async function getUsers() {
      const uri = new URL('users', globalThis.location.href).href
      const response = await fetch(uri, { method: 'GET' })
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
    getUsers().catch((error) => {
      setErrorMessage(String(error))
    })
  }, [])

  async function deleteUser(id: GridRowId) {
    const change = new DeleteUserChange({
      typeName: 'DeleteUserChange',
      userId: id as string,
    })
    await changeManager.submit(change)
    setUsers((prevUsers) => prevUsers.filter((row) => row._id !== id))
  }

  function isCurrentUser(id: GridRowId) {
    const userId = readConfObject(session.getPluginConfiguration(), 'userId')
    return id === userId
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
      getOptionLabel(value) {
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

  async function processRowUpdate(newRow: GridRowModel) {
    const change = new UserChange({
      typeName: 'UserChange',
      role: newRow.role,
      userId: newRow._id,
    })
    await changeManager.submit(change)
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
        <div style={{ height: '100%', width: '100%' }}>
          <DataGrid
            pagination
            rows={users}
            columns={gridColumns}
            getRowId={(row) => row._id}
            showToolbar
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
