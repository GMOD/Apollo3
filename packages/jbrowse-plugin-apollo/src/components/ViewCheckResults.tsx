/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/use-unknown-in-catch-callback-variable */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { getRoot } from '@jbrowse/mobx-state-tree'
import {
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
  MenuItem,
  Select,
  type SelectChangeEvent,
} from '@mui/material'
import {
  DataGrid,
  type GridColDef,
  type GridRowsProp,
  GridToolbar,
} from '@mui/x-data-grid'
import React, { useEffect, useState } from 'react'

import { type ApolloInternetAccountModel } from '../ApolloInternetAccount/model'
import { type ApolloSessionModel } from '../session'
import { type ApolloRootModel } from '../types'
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
  const [selectedAssembly, setSelectedAssembly] = useState(assemblies.at(0))

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
    getGridData().catch((error) => {
      setErrorMessage(String(error))
    })
  }, [selectedAssembly, apolloInternetAccount, baseURL])

  function handleChangeAssembly(e: SelectChangeEvent) {
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
            {option.displayName}
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
