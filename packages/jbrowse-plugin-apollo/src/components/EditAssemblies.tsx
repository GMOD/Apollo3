/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable @typescript-eslint/unbound-method */
import { getRoot } from '@jbrowse/mobx-state-tree'
import {
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
  MenuItem,
  Select,
  type SelectChangeEvent,
  Stack,
  TextField,
} from '@mui/material'
import React, { useEffect, useMemo, useState } from 'react'

import type { ApolloInternetAccountModel } from '../ApolloInternetAccount/model'
import type { ApolloSessionModel } from '../session'
import type { ApolloRootModel } from '../types'
import { createFetchErrorMessage } from '../util'

import { Dialog } from './Dialog'

interface EditAssembliesProps {
  session: ApolloSessionModel
  handleClose(): void
}

interface AssemblyResponse {
  _id: string
  name: string
  displayName?: string
  scientificName?: string
}

export function EditAssemblies({ handleClose, session }: EditAssembliesProps) {
  const { internetAccounts } = getRoot<ApolloRootModel>(session)
  const apolloInternetAccounts = internetAccounts
    .filter((ia) => ia.type === 'ApolloInternetAccount')
    .filter((ia) => (ia as ApolloInternetAccountModel & { role?: string }).role)
    .filter((ia) =>
      (
        (ia as ApolloInternetAccountModel & { role?: string }).role ?? ''
      ).includes('admin'),
    ) as ApolloInternetAccountModel[]

  if (apolloInternetAccounts.length === 0) {
    throw new Error('No Apollo admin internet account found')
  }

  const [selectedInternetAccount, setSelectedInternetAccount] = useState(
    apolloInternetAccounts[0],
  )
  const [assemblies, setAssemblies] = useState<AssemblyResponse[]>([])
  const [selectedAssemblyId, setSelectedAssemblyId] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [organismName, setOrganismName] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    async function loadAssemblies() {
      const { baseURL } = selectedInternetAccount
      const uri = new URL('assemblies', baseURL).href
      const apolloFetch = selectedInternetAccount.getFetcher({
        locationType: 'UriLocation',
        uri,
      })
      const response = await apolloFetch(uri, { method: 'GET' })
      if (!response.ok) {
        const newErrorMessage = await createFetchErrorMessage(
          response,
          'Error when loading assemblies',
        )
        throw new Error(newErrorMessage)
      }

      const data = (await response.json()) as AssemblyResponse[]
      const sorted = [...data].sort((a, b) => a.name.localeCompare(b.name))
      setAssemblies(sorted)
      if (sorted.length > 0) {
        const [first] = sorted
        setSelectedAssemblyId(first._id)
        setDisplayName(first.displayName ?? first.name)
        setOrganismName(first.scientificName ?? '')
      } else {
        setSelectedAssemblyId('')
        setDisplayName('')
        setOrganismName('')
      }
    }

    loadAssemblies().catch((error: unknown) => {
      setErrorMessage(String(error))
    })
  }, [selectedInternetAccount])

  const selectedAssembly = useMemo(
    () => assemblies.find((assembly) => assembly._id === selectedAssemblyId),
    [assemblies, selectedAssemblyId],
  )

  function handleChangeInternetAccount(e: SelectChangeEvent) {
    const next = apolloInternetAccounts.find(
      (ia) => ia.internetAccountId === e.target.value,
    )
    if (!next) {
      throw new Error(
        `Could not find internet account with id "${e.target.value}"`,
      )
    }
    setSelectedInternetAccount(next)
    setErrorMessage('')
  }

  function handleChangeAssembly(e: SelectChangeEvent) {
    const nextAssembly = assemblies.find((a) => a._id === e.target.value)
    setSelectedAssemblyId(e.target.value)
    setDisplayName(nextAssembly?.displayName ?? nextAssembly?.name ?? '')
    setOrganismName(nextAssembly?.scientificName ?? '')
    setErrorMessage('')
  }

  async function handleSave() {
    if (!selectedAssembly) {
      setErrorMessage('Select an assembly first.')
      return
    }

    setIsSaving(true)
    setErrorMessage('')
    try {
      const { baseURL } = selectedInternetAccount
      const uri = new URL(`assemblies/${selectedAssembly._id}`, baseURL).href
      const apolloFetch = selectedInternetAccount.getFetcher({
        locationType: 'UriLocation',
        uri,
      })
      const response = await apolloFetch(uri, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          displayName: displayName.trim() || selectedAssembly.name,
          scientificName: organismName.trim() || undefined,
        }),
      })

      if (!response.ok) {
        const newErrorMessage = await createFetchErrorMessage(
          response,
          'Error when updating assembly',
        )
        throw new Error(newErrorMessage)
      }

      const updated = (await response.json()) as AssemblyResponse
      setAssemblies((prev) =>
        prev.map((assembly) =>
          assembly._id === updated._id ? { ...assembly, ...updated } : assembly,
        ),
      )
      setDisplayName(updated.displayName ?? updated.name)
      setOrganismName(updated.scientificName ?? '')
    } catch (error) {
      setErrorMessage(String(error))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog
      open
      title="Edit assemblies"
      handleClose={handleClose}
      maxWidth={false}
      data-testid="edit-assemblies"
    >
      <DialogContent style={{ minWidth: 520 }}>
        {apolloInternetAccounts.length > 1 ? (
          <>
            <DialogContentText>Select account</DialogContentText>
            <Select
              value={selectedInternetAccount.internetAccountId}
              onChange={handleChangeInternetAccount}
            >
              {apolloInternetAccounts.map((option) => (
                <MenuItem key={option.id} value={option.internetAccountId}>
                  {option.name}
                </MenuItem>
              ))}
            </Select>
          </>
        ) : null}

        <Stack spacing={1.5} sx={{ mt: 2 }}>
          <DialogContentText>Select assembly</DialogContentText>
          <Select
            value={selectedAssemblyId}
            onChange={handleChangeAssembly}
            disabled={assemblies.length === 0 || isSaving}
          >
            {assemblies.map((assembly) => (
              <MenuItem key={assembly._id} value={assembly._id}>
                {assembly.displayName ?? assembly.name}
              </MenuItem>
            ))}
          </Select>

          <TextField
            label="Assembly id"
            value={selectedAssembly?.name ?? ''}
            disabled
            fullWidth
          />

          <TextField
            label="Display name"
            value={displayName}
            onChange={(e) => {
              setDisplayName(e.target.value)
            }}
            disabled={!selectedAssembly || isSaving}
            fullWidth
          />

          <TextField
            label="Organism name"
            helperText="Shown as Organism in workspace and permissions tables"
            value={organismName}
            onChange={(e) => {
              setOrganismName(e.target.value)
            }}
            disabled={!selectedAssembly || isSaving}
            fullWidth
          />

          {errorMessage ? (
            <DialogContentText color="error">{errorMessage}</DialogContentText>
          ) : null}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={!selectedAssembly || isSaving}
        >
          Save
        </Button>
        <Button variant="outlined" onClick={handleClose}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
}
