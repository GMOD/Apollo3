import { Assembly } from '@jbrowse/core/assemblyManager/assembly'
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
  GridColDef,
  GridRowsProp,
  GridToolbar,
} from '@mui/x-data-grid'
import { getRoot } from 'mobx-state-tree'
import React, { useEffect, useState } from 'react'

import { ApolloInternetAccountModel } from '../ApolloInternetAccount/model'
import { ApolloSessionModel } from '../session'
import { ApolloRootModel } from '../types'
import { createFetchErrorMessage } from '../util'
import { Dialog } from './Dialog'

interface ViewCheckResultsProps {
  session: ApolloSessionModel
  handleClose(): void
}

export function ViewCheckResults({
  handleClose,
  session,
}: ViewCheckResultsProps) {
  const { internetAccounts } = getRoot<ApolloRootModel>(session)
  const { collaborationServerDriver } = session.apolloDataStore
  const apolloInternetAccount = internetAccounts.find(
    (ia) => ia.type === 'ApolloInternetAccount',
  ) as ApolloInternetAccountModel | undefined
  if (!apolloInternetAccount) {
    throw new Error('No Apollo internet account found')
  }
  const { baseURL } = apolloInternetAccount
  const [errorMessage, setErrorMessage] = useState<string>()
  const [selectedAssembly, setSelectedAssembly] = useState<Assembly>()
  const [displayGridData, setDisplayGridData] = useState<GridRowsProp[]>([])

  const gridColumns: GridColDef[] = [
    { field: '_id', headerName: 'id', width: 50 },
    {
      field: 'name',
      headerName: 'Check name',
      width: 200,
    },
    { field: 'refSeq', headerName: 'Reference sequence ID', width: 200 },
    { field: 'ids', headerName: 'Feature IDs', width: 200 },
    { field: 'message', headerName: 'Message', flex: 1 },
  ]

  const assemblies = collaborationServerDriver.getAssemblies()
  useEffect(() => {
    if (!selectedAssembly && assemblies.length > 0) {
      setSelectedAssembly(assemblies[0])
    }
  }, [assemblies, selectedAssembly])

  useEffect(() => {
    async function getGridData() {
      const assemblyId: string | undefined = selectedAssembly?.name
      if (!assemblyId) {
        return
      }
      const url = new URL('checks', baseURL)
      const searchParams = new URLSearchParams({ assembly: assemblyId })
      url.search = searchParams.toString()
      const uri = url.toString()
      const apolloFetch = apolloInternetAccount?.getFetcher({
        locationType: 'UriLocation',
        uri,
      })
      if (apolloFetch) {
        const response = await apolloFetch(uri, {
          headers: new Headers({ 'Content-Type': 'application/json' }),
        })
        if (!response.ok) {
          const newErrorMessage = await createFetchErrorMessage(
            response,
            'Error when retrieving checks',
          )
          setErrorMessage(newErrorMessage)
          return
        }
        const data = await response.json()
        setDisplayGridData(data)
      }
    }
    getGridData().catch((error) => setErrorMessage(String(error)))
  }, [selectedAssembly, apolloInternetAccount, baseURL])

  function handleChangeAssembly(e: SelectChangeEvent<string>) {
    const newAssembly = assemblies.find((asm) => asm.name === e.target.value)
    setSelectedAssembly(newAssembly)
  }

  return (
    <Dialog
      open
      fullScreen
      title="View check results"
      handleClose={handleClose}
      data-testid="view-check-results"
    >
      <Select
        style={{ width: 200, marginLeft: 40 }}
        value={selectedAssembly?.name ?? ''}
        onChange={handleChangeAssembly}
        disabled={assemblies.length === 0}
      >
        {assemblies.map((option) => (
          <MenuItem key={option.name} value={option.name}>
            {option.displayName ?? option.name}
          </MenuItem>
        ))}
      </Select>

      <DialogContent>
        <DataGrid
          pagination
          rows={displayGridData}
          columns={gridColumns}
          getRowId={(row) => row._id}
          slots={{ toolbar: GridToolbar }}
          initialState={{
            sorting: { sortModel: [{ field: 'name', sort: 'asc' }] },
            columns: { columnVisibilityModel: { name: true } },
          }}
        />
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
