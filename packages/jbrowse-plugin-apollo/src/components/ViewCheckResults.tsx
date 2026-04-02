/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/use-unknown-in-catch-callback-variable */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
} from '@mui/material'
import { DataGrid, type GridColDef, type GridRowsProp } from '@mui/x-data-grid'
import React, { useEffect, useState } from 'react'

import type { ApolloSessionModel } from '../session'

import { Dialog } from './Dialog'

interface ViewCheckResultsProps {
  session: ApolloSessionModel
  handleClose(): void
  assembly: string
}

export function ViewCheckResults({
  handleClose,
  session,
  assembly: assemblyName,
}: ViewCheckResultsProps) {
  const [errorMessage, setErrorMessage] = useState<string>()
  const [displayGridData, setDisplayGridData] = useState<GridRowsProp[]>([])

  const { apolloDataStore } = session

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

  useEffect(() => {
    async function getGridData() {
      const backendDriver = apolloDataStore.getBackendDriver(assemblyName)
      if (!backendDriver) {
        setErrorMessage(`No driver found for assembly "${assemblyName}"`)
        return
      }
      const data = await backendDriver.getCheckResults(assemblyName)
      // @ts-expect-error not sure how to type this
      setDisplayGridData(data)
    }
    getGridData().catch((error) => {
      setErrorMessage(String(error))
    })
  }, [apolloDataStore, assemblyName])

  return (
    <Dialog
      open
      fullScreen
      title="View check results"
      handleClose={handleClose}
      data-testid="view-check-results"
    >
      <DialogContent>
        <DialogContentText>Check results for {assemblyName}</DialogContentText>
        <DataGrid
          pagination
          rows={displayGridData}
          columns={gridColumns}
          getRowId={(row) => row._id}
          showToolbar
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
