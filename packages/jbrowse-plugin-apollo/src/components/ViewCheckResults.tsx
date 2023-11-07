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

interface AssemblyDocument {
  _id: string
  name: string
}

export function ViewCheckResults({
  handleClose,
  session,
}: ViewCheckResultsProps) {
  const { internetAccounts } = getRoot<ApolloRootModel>(session)
  const apolloInternetAccount = internetAccounts.find(
    (ia) => ia.type === 'ApolloInternetAccount',
  ) as ApolloInternetAccountModel | undefined
  if (!apolloInternetAccount) {
    throw new Error('No Apollo internet account found')
  }
  const { baseURL } = apolloInternetAccount
  const [errorMessage, setErrorMessage] = useState<string>()
  const [assemblyCollection, setAssemblyCollection] = useState<
    AssemblyDocument[]
  >([])
  const [assemblyId, setAssemblyId] = useState<string>('')
  const [displayGridData, setDisplayGridData] = useState<GridRowsProp[]>([])

  const gridColumns: GridColDef[] = [
    {
      field: 'name',
      headerName: 'Check name',
      width: 200,
    },
    { field: 'refSeq', headerName: 'Reference sequence ID', width: 200 },
    { field: 'ids', headerName: 'Feature IDs', width: 200 },
    { field: 'message', headerName: 'Message', flex: 1 },
  ]

  useEffect(() => {
    async function getAssemblies() {
      const uri = new URL('/assemblies', baseURL).href
      const apolloFetch = apolloInternetAccount?.getFetcher({
        locationType: 'UriLocation',
        uri,
      })
      if (apolloFetch) {
        const response = await apolloFetch(uri, { method: 'GET' })
        if (!response.ok) {
          const newErrorMessage = await createFetchErrorMessage(
            response,
            'Error when retrieving assemblies from server',
          )
          setErrorMessage(newErrorMessage)
          return
        }
        const data = (await response.json()) as AssemblyDocument[]
        setAssemblyCollection(data)
      }
    }
    getAssemblies().catch((error) => setErrorMessage(String(error)))
  }, [apolloInternetAccount, baseURL])

  useEffect(() => {
    if (!assemblyId && assemblyCollection.length > 0) {
      setAssemblyId(assemblyCollection[0]._id)
    }
  }, [assemblyId, assemblyCollection])

  useEffect(() => {
    async function getGridData() {
      const url = new URL('checks', baseURL)
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
        console.log(data)
        setDisplayGridData(data)
      }
    }
    getGridData().catch((error) => setErrorMessage(String(error)))
  }, [assemblyId, apolloInternetAccount, baseURL])

  async function handleChangeAssembly(e: SelectChangeEvent<string>) {
    setAssemblyId(e.target.value as string)
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
        value={assemblyId}
        onChange={handleChangeAssembly}
      >
        {assemblyCollection.map((option) => (
          <MenuItem key={option._id} value={option._id}>
            {option.name}
          </MenuItem>
        ))}
      </Select>

      <DialogContent>
        <DataGrid
          pagination
          rows={displayGridData}
          columns={gridColumns}
          getRowId={(row) => row.message}
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
