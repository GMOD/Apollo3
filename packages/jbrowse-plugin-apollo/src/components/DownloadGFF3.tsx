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
  SelectChangeEvent,
} from '@mui/material'
import { getRoot } from 'mobx-state-tree'
import React, { useState } from 'react'

import { createFetchErrorMessage } from '../util'
import { AssemblyData, useAssemblies } from './'

interface DownloadGFF3Props {
  session: AbstractSessionModel
  handleClose(): void
}

export function DownloadGFF3({ session, handleClose }: DownloadGFF3Props) {
  const { internetAccounts } = getRoot(session) as AppRootModel
  const [selectedAssembly, setSelectedAssembly] = useState<AssemblyData>()
  const [errorMessage, setErrorMessage] = useState('')

  const assemblies = useAssemblies(internetAccounts, setErrorMessage)

  function handleChangeAssembly(e: SelectChangeEvent<string>) {
    const newAssembly = assemblies.find((asm) => asm._id === e.target.value)
    setSelectedAssembly(newAssembly)
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    if (!selectedAssembly) {
      setErrorMessage('Must select assembly to download')
      return
    }

    const { internetAccount } = selectedAssembly
    const url = new URL('features/getExportID', internetAccount.baseURL)
    const searchParams = new URLSearchParams({ assembly: selectedAssembly._id })
    url.search = searchParams.toString()
    const uri = url.toString()
    const apolloFetch = internetAccount.getFetcher({
      locationType: 'UriLocation',
      uri,
    })
    const response = await apolloFetch(uri, { method: 'GET' })
    if (!response.ok) {
      const newErrorMessage = await createFetchErrorMessage(
        response,
        'Error when exporting ID',
      )
      setErrorMessage(newErrorMessage)
      return
    }
    const { exportID } = (await response.json()) as { exportID: string }

    const exportURL = new URL('features/exportGFF3', internetAccount.baseURL)
    const exportSearchParams = new URLSearchParams({ exportID })
    exportURL.search = exportSearchParams.toString()
    const exportUri = exportURL.toString()

    window.open(exportUri, '_blank')
    handleClose()
  }

  return (
    <Dialog open maxWidth="xl" data-testid="login-apollo">
      <DialogTitle>Export GFF3</DialogTitle>
      <form onSubmit={onSubmit}>
        <DialogContent style={{ display: 'flex', flexDirection: 'column' }}>
          <DialogContentText>Select assembly</DialogContentText>
          <Select
            labelId="label"
            value={selectedAssembly?._id || ''}
            onChange={handleChangeAssembly}
            disabled={!assemblies.length}
          >
            {assemblies.map((option) => (
              <MenuItem key={option._id} value={option._id}>
                {option.name}
              </MenuItem>
            ))}
          </Select>
          <DialogContentText>
            Select assembly to export to GFF3
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            disabled={!selectedAssembly}
            variant="contained"
            type="submit"
          >
            Download
          </Button>
          <Button
            variant="outlined"
            type="submit"
            onClick={() => {
              handleClose()
            }}
          >
            Cancel
          </Button>
        </DialogActions>
      </form>
      {errorMessage ? (
        <DialogContent>
          <DialogContentText color="error">{errorMessage}</DialogContentText>
        </DialogContent>
      ) : null}
    </Dialog>
  )
}
