/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/use-unknown-in-catch-callback-variable */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { changeRegistry } from '@apollo-annotation/common'
import type { AbstractSessionModel } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
} from '@mui/material'
import {
  DataGrid,
  type GridColDef,
  type GridFilterModel,
  type GridPaginationModel,
  type GridRowsProp,
  type GridSortModel,
} from '@mui/x-data-grid'
import React, { useEffect, useState } from 'react'

import type { GetChangesOpts } from '../BackendDrivers/BackendDriver'
import type { ApolloSessionModel } from '../session'

import { Dialog } from './Dialog'
import { apolloDataGridSx } from './dataGridStyles'

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

function buildFiltersFromModel(
  filterModel: GridFilterModel,
): GetChangesOpts['filters'] {
  const filters: NonNullable<GetChangesOpts['filters']> = {}
  for (const item of filterModel.items) {
    if (item.value === undefined || item.value === '' || item.value === null) {
      continue
    }
    switch (item.field) {
      case 'user': {
        filters.user = String(item.value)
        break
      }
      case 'typeName': {
        filters.typeName = String(item.value)
        break
      }
      case 'createdAt': {
        const date = new Date(
          item.value as string | number | Date,
        ).toISOString()
        if (item.operator === 'after' || item.operator === 'onOrAfter') {
          filters.startTime = date
        } else if (
          item.operator === 'before' ||
          item.operator === 'onOrBefore'
        ) {
          filters.endTime = date
        }
        break
      }
    }
  }
  return filters
}

export function ViewChangeLog({
  handleClose,
  session,
  assembly: assemblyId,
}: ViewChangeLogProps) {
  const { classes } = useStyles()
  const [errorMessage, setErrorMessage] = useState<string>()
  const [displayGridData, setDisplayGridData] = useState<GridRowsProp[]>([])
  const [rowCount, setRowCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 15,
  })
  const [sortModel, setSortModel] = useState<GridSortModel>([
    { field: 'sequence', sort: 'desc' },
  ])
  const [filterModel, setFilterModel] = useState<GridFilterModel>({
    items: [],
  })

  const { apolloDataStore } = session
  const { assemblyManager } = session as unknown as AbstractSessionModel
  const assembly = assemblyManager.get(assemblyId)
  const assemblyName = assembly?.displayName ?? assemblyId

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
      sortable: false,
      filterable: false,
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
      const backendDriver = apolloDataStore.getBackendDriver(assemblyId)
      if (!backendDriver) {
        setErrorMessage(`No driver found for assembly "${assemblyId}"`)
        return
      }
      setLoading(true)
      const [sortEntry] = sortModel
      const sortField = sortEntry?.field
      const sortOrderValue = sortEntry?.sort
      const sortOrder: 'asc' | 'desc' | undefined =
        sortOrderValue === 'asc' || sortOrderValue === 'desc'
          ? sortOrderValue
          : undefined
      const { changes, totalCount } = await backendDriver.getChanges(
        assemblyId,
        {
          page: paginationModel.page,
          pageSize: paginationModel.pageSize,
          sortField,
          sortOrder,
          filters: buildFiltersFromModel(filterModel),
        },
      )
      const gridData = changes.map((change) => {
        const {
          sequence,
          typeName,
          changes: nestedChanges,
          user,
          createdAt,
          ...rest
        } = change
        const changeData = nestedChanges ?? { typeName, ...rest }
        return { sequence, typeName, changeData, user, createdAt }
      })
      // @ts-expect-error not sure how to type this
      setDisplayGridData(gridData)
      setRowCount(totalCount)
    }
    getGridData()
      .catch((error) => {
        setErrorMessage(String(error))
      })
      .finally(() => {
        setLoading(false)
      })
  }, [apolloDataStore, assemblyId, paginationModel, sortModel, filterModel])

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
          paginationMode="server"
          sortingMode="server"
          filterMode="server"
          rowCount={rowCount}
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          sortModel={sortModel}
          onSortModelChange={setSortModel}
          filterModel={filterModel}
          onFilterModelChange={setFilterModel}
          loading={loading}
          rows={displayGridData}
          columns={gridColumns}
          getRowId={(row) => row.sequence}
          showToolbar
          sx={apolloDataGridSx}
          pageSizeOptions={[5, 15, 25, 50, 100]}
          initialState={{
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
