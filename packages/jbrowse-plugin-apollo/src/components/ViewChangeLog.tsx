import { AbstractSessionModel, AppRootModel } from '@jbrowse/core/util'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  MenuItem,
  Select,
} from '@material-ui/core'
import UndoIcon from '@material-ui/icons/Undo'
import {
  DataGrid,
  GridActionsCellItem,
  GridColumns,
  GridRowsProp,
  GridToolbar,
} from '@mui/x-data-grid'
import { getRoot } from 'mobx-state-tree'
import React, { useEffect, useState } from 'react'

import { ApolloInternetAccountModel } from '../ApolloInternetAccount/model'

interface ViewChangeLogProps {
  session: AbstractSessionModel
  handleClose(): void
}

interface Collection {
  _id: string
  name: string
}

export function ViewChangeLog({ session, handleClose }: ViewChangeLogProps) {
  const { internetAccounts } = getRoot(session) as AppRootModel
  const apolloInternetAccount = internetAccounts.find(
    (ia) => ia.type === 'ApolloInternetAccount',
  ) as ApolloInternetAccountModel | undefined
  if (!apolloInternetAccount) {
    throw new Error('No Apollo internet account found')
  }
  const { baseURL } = apolloInternetAccount
  const [errorMessage, setErrorMessage] = useState('')
  const [assemblyCollection, setAssemblyCollection] = useState<Collection[]>([])
  const [assemblyId, setAssemblyId] = useState('')
  const [displayGridData, setDisplayGridData] = useState<GridRowsProp[]>([])

  const gridColumns: GridColumns = [
    {
      field: 'actions',
      type: 'actions',
      width: 80,
      getActions: (/* params */) => [
        <GridActionsCellItem
          icon={<UndoIcon />}
          label="Undo"
          // eslint-disable-next-line @typescript-eslint/no-empty-function
          onClick={() => {}}
          disabled
          showInMenu
        />,
      ],
    },
    {
      field: 'typeName',
      headerName: 'Change type',
      width: 200,
      type: 'singleSelect',
      valueOptions: [
        'AddAssemblyFromFileChange',
        'AddFeaturesFromFileChange',
        'LocationEndChange',
        'LocationStartChange',
        'TypeChange',
      ],
    },
    {
      field: 'changes',
      headerName: 'Change JSON',
      width: 600,
      renderCell: ({ value }) => (
        <div style={{ fontFamily: 'monospace' }}>{JSON.stringify(value)}</div>
      ),
      valueFormatter: ({ value }) => JSON.stringify(value),
    },
    { field: 'user', headerName: 'User', width: 100 },
    {
      field: 'createdAt',
      headerName: 'Time',
      width: 200,
      type: 'dateTime',
      valueGetter: ({ value }) => value && new Date(value),
    },
  ]

  useEffect(() => {
    async function getAssemblies() {
      const uri = new URL('/assemblies', baseURL).href
      const apolloFetch = apolloInternetAccount?.getFetcher({
        locationType: 'UriLocation',
        uri,
      })
      if (apolloFetch) {
        const response = await apolloFetch(uri, {
          method: 'GET',
        })
        if (!response.ok) {
          let msg
          try {
            msg = await response.text()
          } catch (e) {
            msg = ''
          }
          setErrorMessage(
            `Error when retrieving assemblies from server — ${
              response.status
            } (${response.statusText})${msg ? ` (${msg})` : ''}`,
          )
          return
        }
        const data = await response.json()
        data.forEach((item: Collection) => {
          setAssemblyCollection((result) => [
            ...result,
            {
              _id: item._id,
              name: item.name,
            },
          ])
        })
      }
    }
    getAssemblies()
  }, [apolloInternetAccount, baseURL])

  useEffect(() => {
    async function getGridData() {
      let msg

      // Get changes
      const url = new URL('changes', baseURL)
      const searchParams = new URLSearchParams({ assemblyId })
      url.search = searchParams.toString()
      const uri = url.toString()
      const apolloFetch = apolloInternetAccount?.getFetcher({
        locationType: 'UriLocation',
        uri,
      })
      if (apolloFetch) {
        const res = await apolloFetch(uri, {
          headers: new Headers({ 'Content-Type': 'application/json' }),
        })
        if (!res.ok) {
          try {
            msg = await res.text()
          } catch (e) {
            msg = ''
          }
          setErrorMessage(
            `Error when retrieving changes — ${res.status} (${res.statusText})${
              msg ? ` (${msg})` : ''
            }`,
          )
          return
        }
        const data = await res.json()
        setDisplayGridData(data)
      }
    }
    getGridData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assemblyId])

  useEffect(() => {
    if (assemblyCollection.length === 1) {
      setAssemblyId(assemblyCollection[0]._id)
    }
  }, [assemblyCollection])

  async function handleChangeAssembly(
    e: React.ChangeEvent<{
      name?: string | undefined
      value: unknown
    }>,
  ) {
    setAssemblyId(e.target.value as string)
  }

  return (
    <Dialog open maxWidth="xl" data-testid="login-apollo" fullScreen>
      <DialogTitle>
        View change log
        <div style={{ width: 100 }} />
        <Select
          style={{ width: 200 }}
          value={assemblyId}
          onChange={handleChangeAssembly}
        >
          {assemblyCollection.map((option) => (
            <MenuItem key={option._id} value={option._id}>
              {option.name}
            </MenuItem>
          ))}
        </Select>
      </DialogTitle>

      <DialogContent>
        <div style={{ height: '100%', width: '100%' }}>
          <DataGrid
            // className={classes.root}
            autoPageSize
            pagination
            rows={displayGridData}
            columns={gridColumns}
            getRowId={(row) => row._id}
            components={{ Toolbar: GridToolbar }}
            getRowHeight={() => 'auto'}
          />
        </div>
      </DialogContent>
      <DialogActions>
        <Button
          variant="outlined"
          type="submit"
          onClick={() => {
            handleClose()
          }}
        >
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
