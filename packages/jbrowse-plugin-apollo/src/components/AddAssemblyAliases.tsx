import { AddAssemblyAliasesChange } from '@apollo-annotation/shared'
import { Box, DialogContent, DialogContentText } from '@mui/material'
import { DataGrid, type GridColDef, type GridRowModel } from '@mui/x-data-grid'
import React from 'react'

import type {
  ApolloInternetAccount,
  CollaborationServerDriver,
} from '../BackendDrivers'
import type { ChangeManager } from '../ChangeManager'
import type { ApolloSessionModel } from '../session'

import { Dialog } from './Dialog'

interface AddAssemblyAliasProps {
  session: ApolloSessionModel
  handleClose: () => void
  changeManager: ChangeManager
}

const columns: GridColDef[] = [
  {
    field: 'name',
    headerName: 'Assembly Name',
    width: 150,
    editable: false,
  },
  {
    field: 'aliases',
    headerName: 'Aliases',
    width: 300,
    editable: true,
  },
]

interface AssemblyAlias {
  id: string
  name: string
  aliases: string
}

export function AddAssemblyAliases({
  changeManager,
  handleClose,
  session,
}: AddAssemblyAliasProps) {
  const { apolloDataStore } = session
  const { collaborationServerDriver } = apolloDataStore as {
    collaborationServerDriver: CollaborationServerDriver
    getInternetAccount(
      assemblyName?: string,
      internetAccountId?: string,
    ): ApolloInternetAccount
  }
  const assemblies = collaborationServerDriver.getAssemblies()

  const rows: AssemblyAlias[] = assemblies.map((assembly) => {
    return {
      id: assembly.name,
      name: assembly.displayName,
      aliases: assembly.aliases.join(', '),
    } as AssemblyAlias
  })

  const [errorMessage, setErrorMessage] = React.useState('')

  const processRowUpdate = (newRow: GridRowModel, _oldRow: GridRowModel) => {
    const change = new AddAssemblyAliasesChange({
      typeName: 'AddAssemblyAliasesChange',
      assembly: newRow.id as string,
      aliases: (newRow.aliases as string).split(','),
    })
    void changeManager.submit(change).catch(() => {
      setErrorMessage('Error submitting change')
    })
    handleClose()
    return newRow
  }

  return (
    <Dialog
      open
      title="Add assembly aliases"
      handleClose={handleClose}
      maxWidth={'sm'}
      data-testid="add-assembly-alias"
      fullWidth
    >
      <DialogContent style={{ display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ height: 400, width: '100%' }}>
          <DataGrid
            rows={rows}
            columns={columns}
            initialState={{
              pagination: {
                paginationModel: {
                  pageSize: 5,
                },
              },
            }}
            pageSizeOptions={[5]}
            processRowUpdate={processRowUpdate}
            disableRowSelectionOnClick
          />
        </Box>
      </DialogContent>
      {errorMessage ? (
        <DialogContent>
          <DialogContentText color="error">{errorMessage}</DialogContentText>
        </DialogContent>
      ) : null}
    </Dialog>
  )
}
