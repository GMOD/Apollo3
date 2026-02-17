/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/use-unknown-in-catch-callback-variable */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { changeRegistry } from '@apollo-annotation/common'
import { makeStyles } from '@jbrowse/core/util/tss-react'
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

import type { ApolloInternetAccountModel } from '../ApolloInternetAccount/model'
import type {
  ApolloInternetAccount,
  CollaborationServerDriver,
} from '../BackendDrivers'
import type { ApolloSessionModel } from '../session'
import type { ApolloRootModel } from '../types'
import { createFetchErrorMessage } from '../util'

import { Dialog } from './Dialog'

interface ViewChangeLogProps {
  session: ApolloSessionModel
  handleClose(): void
}

const useStyles = makeStyles()((theme) => ({
  changeTextarea: {
    fontFamily: 'monospace',
    width: 600,
    resize: 'none',
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
  },
}))

export function ViewChangeLog({ handleClose, session }: ViewChangeLogProps) {
  const { internetAccounts } = getRoot<ApolloRootModel>(session)
  const apolloInternetAccount = internetAccounts.find(
    (ia) => ia.type === 'ApolloInternetAccount',
  ) as ApolloInternetAccountModel | undefined
  if (!apolloInternetAccount) {
    throw new Error('No Apollo internet account found')
  }
  const { baseURL } = apolloInternetAccount
  const { classes } = useStyles()
  const [errorMessage, setErrorMessage] = useState<string>()
  const [displayGridData, setDisplayGridData] = useState<GridRowsProp[]>([])

  const { collaborationServerDriver } = session.apolloDataStore as {
    collaborationServerDriver: CollaborationServerDriver
    getInternetAccount(
      assemblyName?: string,
      internetAccountId?: string,
    ): ApolloInternetAccount
  }
  const assemblies = collaborationServerDriver.getAssemblies()
  const [selectedAssembly, setSelectedAssembly] = useState(assemblies.at(0))

  const gridColumns: GridColDef[] = [
    { field: 'sequence' },
    {
      field: 'typeName',
      headerName: 'Change type',
      width: 200,
      type: 'singleSelect',
      // TODO: Get these from change manager once it's on the session
      valueOptions: [...changeRegistry.changes.keys()],
    },
    {
      field: 'changes',
      headerName: 'Change JSON',
      width: 600,
      renderCell: ({ value }) => (
        <textarea
          className={classes.changeTextarea}
          value={JSON.stringify(value)}
          readOnly
        />
      ),
    },
    { field: 'user', headerName: 'User', width: 140 },
    {
      field: 'createdAt',
      headerName: 'Time',
      width: 160,
      type: 'dateTime',
      valueGetter: (value) => value && new Date(value),
    },
  ]

  useEffect(() => {
    async function getGridData() {
      if (!selectedAssembly) {
        return
      }

      // Get changes
      const url = new URL('changes', baseURL)
      const searchParams = new URLSearchParams({
        assembly: selectedAssembly.name,
      })
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
            'Error when retrieving changes',
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
  }, [apolloInternetAccount, baseURL, selectedAssembly])

  function handleChangeAssembly(e: SelectChangeEvent) {
    const newAssembly = assemblies.find((asm) => asm.name === e.target.value)
    setSelectedAssembly(newAssembly)
  }

  return (
    <Dialog
      open
      fullScreen
      title="View change log"
      handleClose={handleClose}
      data-testid="view-changelog"
    >
      <Select
        style={{ width: 200, marginLeft: 40 }}
        value={selectedAssembly?.name ?? ''}
        onChange={handleChangeAssembly}
      >
        {assemblies.map((option) => (
          <MenuItem key={option.name} value={option.name}>
            {option.displayName || option.name}
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
            sorting: { sortModel: [{ field: 'sequence', sort: 'desc' }] },
            columns: { columnVisibilityModel: { sequence: false } },
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
