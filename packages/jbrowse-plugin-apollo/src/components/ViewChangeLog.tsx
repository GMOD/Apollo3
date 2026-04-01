/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/use-unknown-in-catch-callback-variable */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { changeRegistry } from '@apollo-annotation/common'
import { makeStyles } from '@jbrowse/core/util/tss-react'
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

interface ViewChangeLogProps {
  session: ApolloSessionModel
  handleClose(): void
  assembly: string
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

export function ViewChangeLog({
  handleClose,
  session,
  assembly: assemblyName,
}: ViewChangeLogProps) {
  const { classes } = useStyles()
  const [errorMessage, setErrorMessage] = useState<string>()
  const [displayGridData, setDisplayGridData] = useState<GridRowsProp[]>([])

  const { apolloDataStore } = session

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
      field: 'changeData',
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
      const backendDriver = apolloDataStore.getBackendDriver(assemblyName)
      if (!backendDriver) {
        setErrorMessage(`No driver found for assembly "${assemblyName}"`)
        return
      }
      const data = await backendDriver.getChanges(assemblyName)
      const gridData = data.map((change) => {
        const { sequence, typeName, changes, user, createdAt, ...rest } = change
        const changeData = changes ?? { typeName, ...rest }
        return { sequence, typeName, changeData, user, createdAt }
      })
      // @ts-expect-error not sure how to type this
      setDisplayGridData(gridData)
    }
    getGridData().catch((error) => {
      setErrorMessage(String(error))
    })
  }, [apolloDataStore, assemblyName])

  return (
    <Dialog
      open
      fullScreen
      title="View change log"
      handleClose={handleClose}
      data-testid="view-changelog"
    >
      <DialogContent>
        <DialogContentText>Changes for {assemblyName}</DialogContentText>
        <DataGrid
          pagination
          rows={displayGridData}
          columns={gridColumns}
          getRowId={(row) => row.sequence}
          showToolbar
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
