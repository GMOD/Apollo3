import { getDecodedToken } from '@apollo-annotation/shared'
import { applySnapshot, isAlive } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import FilterListIcon from '@mui/icons-material/FilterList'
import {
  Box,
  Button,
  type ChangeEvent,
  Chip,
  DialogActions,
  DialogContent,
  DialogContentText,
  FormControlLabel,
  Switch,
  Typography,
} from '@mui/material'
import {
  DataGrid,
  type GridColDef,
  type GridRenderCellParams,
  GridToolbar,
} from '@mui/x-data-grid'
import React, { useEffect, useMemo, useState } from 'react'

import type { ApolloInternetAccountModel } from '../ApolloInternetAccount/model'
import type { ApolloSessionModel } from '../session'
import { type ApolloRootModel, isApolloInternetAccount } from '../types'
import { createFetchErrorMessage } from '../util'

import { Dialog } from './Dialog'
import { apolloDataGridSx } from './dataGridStyles'

interface AssemblyResponse {
  _id: string
  name: string
  displayName?: string
  scientificName?: string
}

interface AssemblyPermissionResponse {
  _id?: string
  userId: string
  assemblyId: string
  canViewAnnotations: boolean
  canEditAnnotations: boolean
}

interface PermissionRow {
  id: string
  assemblyId: string
  assemblyRefName: string
  assemblyName: string
  genusSpecies: string
  access: 'Edit' | 'View'
}

interface MyAssemblyPermissionsProps {
  rootModel: ApolloRootModel
  handleClose(): void
}

type SessionWithLinearGenomeView = {
  views: unknown[]
  addView?: (viewType: string, ...args: unknown[]) => unknown
  id?: string
  name?: string
}

type ApolloRegion = {
  assemblyName?: string
  refName: string
  start: number
  end: number
}

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function safeRetrieveToken(account: ApolloInternetAccountModel) {
  try {
    if (!isAlive(account)) {
      return undefined
    }
    return account.retrieveToken() || undefined
  } catch {
    return undefined
  }
}

function isGuestToken(token: string) {
  try {
    const { username, email } = getDecodedToken(token)
    return (
      username?.toLowerCase() === 'guest' ||
      email?.toLowerCase() === 'guest_user'
    )
  } catch {
    return false
  }
}

export function MyAssemblyPermissions({
  handleClose,
  rootModel,
}: MyAssemblyPermissionsProps) {
  const { internetAccounts } = rootModel
  const apolloInternetAccounts: ApolloInternetAccountModel[] = internetAccounts
    .filter((ia) => isAlive(ia))
    .filter(isApolloInternetAccount)
    .filter((ia) => Boolean(safeRetrieveToken(ia)))
  const preferredInternetAccount =
    apolloInternetAccounts.find((ia) => {
      const token = safeRetrieveToken(ia)
      return token ? !isGuestToken(token) : false
    }) ?? apolloInternetAccounts[0]
  const [selectedInternetAccount] = useState(preferredInternetAccount)
  const [rows, setRows] = useState<PermissionRow[]>([])
  const [errorMessage, setErrorMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [editOnly, setEditOnly] = useState(false)

  useEffect(() => {
    async function loadPermissions() {
      if (!selectedInternetAccount) {
        setRows([])
        setLoading(false)
        setErrorMessage('Sign in to Apollo, then reopen My workspace.')
        return
      }
      setLoading(true)
      setErrorMessage('')
      const { baseURL } = selectedInternetAccount
      const assembliesUri = new URL('assemblies', baseURL).href
      const permissionsUri = new URL('assemblyPermissions/mine', baseURL).href
      const apolloFetchAssemblies = selectedInternetAccount.getFetcher({
        locationType: 'UriLocation',
        uri: assembliesUri,
      })
      const apolloFetchPermissions = selectedInternetAccount.getFetcher({
        locationType: 'UriLocation',
        uri: permissionsUri,
      })
      const [assembliesResponse, permissionsResponse] = await Promise.all([
        apolloFetchAssemblies(assembliesUri, { method: 'GET' }),
        apolloFetchPermissions(permissionsUri, { method: 'GET' }),
      ])

      if (!assembliesResponse.ok) {
        const newErrorMessage = await createFetchErrorMessage(
          assembliesResponse,
          'Error when loading assemblies',
        )
        throw new Error(newErrorMessage)
      }
      if (!permissionsResponse.ok) {
        const newErrorMessage = await createFetchErrorMessage(
          permissionsResponse,
          'Error when loading your annotation permissions',
        )
        throw new Error(newErrorMessage)
      }

      const assemblies = (await assembliesResponse.json()) as AssemblyResponse[]
      const permissions =
        (await permissionsResponse.json()) as AssemblyPermissionResponse[]
      const assemblyById = new Map(
        assemblies.map((assembly) => [assembly._id, assembly]),
      )

      const nextRows: PermissionRow[] = permissions
        .filter((permission) => permission.canViewAnnotations)
        .map((permission) => {
          const assembly = assemblyById.get(permission.assemblyId)
          const assemblyName =
            assembly?.displayName ?? assembly?.name ?? permission.assemblyId
          const scientificName =
            typeof assembly?.scientificName === 'string'
              ? assembly.scientificName.trim()
              : ''
          return {
            id:
              permission._id ?? `${permission.userId}-${permission.assemblyId}`,
            assemblyId: permission.assemblyId,
            assemblyRefName: assembly?.name ?? permission.assemblyId,
            assemblyName,
            genusSpecies: scientificName || 'Unknown',
            access: permission.canEditAnnotations
              ? ('Edit' as const)
              : ('View' as const),
          }
        })
        .sort((a, b) => a.assemblyName.localeCompare(b.assemblyName))

      setRows(nextRows)
      setLoading(false)
    }

    loadPermissions().catch((error) => {
      setErrorMessage(String(error))
      setRows([])
      setLoading(false)
    })
  }, [selectedInternetAccount])

  const filteredRows = useMemo(
    () => rows.filter((row) => !editOnly || row.access === 'Edit'),
    [editOnly, rows],
  )

  async function loadAssembly(
    assemblyName: string,
    options?: { openInNewView?: boolean },
  ) {
    setErrorMessage('')
    if (
      !isAlive(rootModel) ||
      !rootModel.session ||
      !isAlive(rootModel.session)
    ) {
      setErrorMessage(
        'The current session is no longer available. Reopen My workspace.',
      )
      return
    }
    const sessionModel =
      rootModel.session as unknown as SessionWithLinearGenomeView & {
        apolloSetSelectedFeature?: (feature?: unknown) => void
      }
    if (!sessionModel) {
      setErrorMessage(
        'The current session is no longer available. Reopen My workspace.',
      )
      return
    }
    const openInNewView = options?.openInNewView ?? false
    let linearGenomeView: LinearGenomeViewModel | undefined

    if (!openInNewView) {
      // Replace semantics: reset to an empty session and create one fresh view.
      const baseSnapshot = {
        id: sessionModel.id,
        name: sessionModel.name,
      }
      applySnapshot(rootModel.session as unknown as object, baseSnapshot)

      const freshSession =
        rootModel.session as unknown as SessionWithLinearGenomeView & {
          apolloSetSelectedFeature?: (feature?: unknown) => void
        }
      const createdView = freshSession.addView?.('LinearGenomeView')
      linearGenomeView =
        (createdView as LinearGenomeViewModel | undefined) ??
        (freshSession.views.find(
          (view) =>
            (view as { type?: string } | undefined)?.type ===
            'LinearGenomeView',
        ) as unknown as LinearGenomeViewModel | undefined)
    } else if (openInNewView && sessionModel.addView) {
      const existingViews = new Set(sessionModel.views)
      const createdView = sessionModel.addView('LinearGenomeView')
      linearGenomeView =
        (createdView as LinearGenomeViewModel | undefined) ??
        (sessionModel.views.find(
          (view) =>
            !existingViews.has(view) &&
            (view as { type?: string } | undefined)?.type ===
              'LinearGenomeView',
        ) as unknown as LinearGenomeViewModel | undefined)
    } else {
      linearGenomeView = sessionModel.views.find(
        (view) =>
          (view as { type?: string } | undefined)?.type === 'LinearGenomeView',
      ) as unknown as LinearGenomeViewModel | undefined
    }

    if (!linearGenomeView && sessionModel.addView && !openInNewView) {
      // Create a linear genome view on-demand so Load works from the start screen.
      const createdView = sessionModel.addView('LinearGenomeView')
      linearGenomeView =
        (createdView as LinearGenomeViewModel | undefined) ??
        (sessionModel.views.find(
          (view) =>
            (view as { type?: string } | undefined)?.type ===
            'LinearGenomeView',
        ) as unknown as LinearGenomeViewModel | undefined)
    }

    if (!linearGenomeView) {
      setErrorMessage('Could not open a Linear Genome View for this session.')
      return
    }

    sessionModel.apolloSetSelectedFeature?.(undefined)

    const getDisplayedAssemblyName = () => {
      const regions = (
        linearGenomeView as unknown as {
          displayedRegions?: { assemblyName?: string }[]
        }
      ).displayedRegions
      return regions?.[0]?.assemblyName
    }

    const openByExplicitRegion = async () => {
      const apolloSession = rootModel.session as unknown as ApolloSessionModel
      const backendDriver =
        apolloSession.apolloDataStore.getBackendDriver(assemblyName)
      if (!backendDriver) {
        return false
      }
      const regions = (await backendDriver.getRegions(
        assemblyName,
      )) as ApolloRegion[]
      const firstRegion = regions[0]
      if (!firstRegion) {
        return false
      }
      linearGenomeView.navToLocation({
        assemblyName,
        refName: firstRegion.refName,
        start: firstRegion.start,
        end: firstRegion.end,
      })
      return true
    }

    let lastError: unknown
    for (let attempt = 0; attempt < 8; attempt++) {
      try {
        linearGenomeView.showAllRegionsInAssembly(assemblyName)
        if (getDisplayedAssemblyName() !== assemblyName) {
          const opened = await openByExplicitRegion()
          if (!opened) {
            throw new Error(
              `Could not resolve selected assembly regions for ${assemblyName}`,
            )
          }
        }
        handleClose()
        return
      } catch (error) {
        lastError = error
        await wait(150)
      }
    }

    setErrorMessage(`Could not load assembly: ${String(lastError)}`)
  }

  const gridColumns: GridColDef[] = [
    {
      field: 'loadAssembly',
      headerName: 'Open',
      sortable: false,
      filterable: false,
      minWidth: 220,
      maxWidth: 240,
      renderCell: ({ row }: GridRenderCellParams<PermissionRow>) => (
        <Box sx={{ display: 'flex', gap: 0.75 }}>
          <Button
            size="small"
            variant="contained"
            color="primary"
            onClick={() => {
              void loadAssembly(row.assemblyRefName)
            }}
            sx={{
              borderRadius: '999px',
              textTransform: 'none',
              minWidth: 0,
              px: 1.25,
              py: 0,
              minHeight: 24,
              fontSize: '0.75rem',
              fontWeight: 600,
              boxShadow: 'none',
              '&:hover': {
                boxShadow: 'none',
              },
            }}
          >
            Replace
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="primary"
            onClick={() => {
              void loadAssembly(row.assemblyRefName, {
                openInNewView: true,
              })
            }}
            sx={{
              borderRadius: '999px',
              textTransform: 'none',
              minWidth: 0,
              px: 1.25,
              py: 0,
              minHeight: 24,
              fontSize: '0.75rem',
              fontWeight: 600,
            }}
          >
            Add view
          </Button>
        </Box>
      ),
    },
    {
      field: 'genusSpecies',
      headerName: 'Organism',
      flex: 1,
      minWidth: 220,
    },
    {
      field: 'assemblyName',
      headerName: 'Assembly',
      flex: 1,
      minWidth: 220,
    },
    {
      field: 'access',
      headerName: 'Annotation access',
      minWidth: 180,
      renderCell: ({ row }: GridRenderCellParams<PermissionRow>) => (
        <Chip
          label={row.access}
          size="small"
          color={row.access === 'Edit' ? 'primary' : 'default'}
          variant={row.access === 'Edit' ? 'filled' : 'outlined'}
          icon={row.access === 'Edit' ? <FilterListIcon /> : undefined}
        />
      ),
    },
  ]

  const editCount = rows.filter((row) => row.access === 'Edit').length

  if (!selectedInternetAccount) {
    return (
      <Dialog
        open
        title="My workspace"
        handleClose={handleClose}
        maxWidth={false}
        data-testid="my-assembly-permissions"
      >
        <DialogContent>
          <DialogContentText>
            No authenticated Apollo session was found. Sign in from the Apollo
            menu and reopen My workspace.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={handleClose}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    )
  }

  return (
    <Dialog
      open
      title="My workspace"
      handleClose={handleClose}
      maxWidth={false}
      data-testid="my-assembly-permissions"
    >
      <DialogContent>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <DialogContentText>
            Assemblies in your Apollo workspace where you can view or edit
            annotations.
          </DialogContentText>
          <FormControlLabel
            control={
              <Switch
                checked={editOnly}
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  setEditOnly(event.target.checked)
                }}
              />
            }
            label="Edit-only"
          />
        </Box>
        <Typography variant="body2" sx={{ mb: 1 }}>
          {filteredRows.length} shown ({editCount} with Edit access)
        </Typography>
        <div style={{ width: 760, maxWidth: '90vw', height: 460 }}>
          <DataGrid
            loading={loading}
            rows={filteredRows}
            columns={gridColumns}
            density="compact"
            sx={apolloDataGridSx}
            disableRowSelectionOnClick
            slots={{ toolbar: GridToolbar }}
            slotProps={{
              toolbar: {
                showQuickFilter: true,
              },
            }}
            pageSizeOptions={[10, 25, 50, 100]}
            initialState={{
              pagination: { paginationModel: { pageSize: 25, page: 0 } },
            }}
          />
        </div>
        {errorMessage ? (
          <Typography color="error" sx={{ mt: 2 }}>
            {errorMessage}
          </Typography>
        ) : null}
      </DialogContent>

      <DialogActions>
        <Button variant="contained" onClick={handleClose}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
}
