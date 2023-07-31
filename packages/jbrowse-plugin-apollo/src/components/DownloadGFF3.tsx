import { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import { getConf } from '@jbrowse/core/configuration'
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
import React, { useState } from 'react'

import {
  ApolloInternetAccount,
  CollaborationServerDriver,
} from '../BackendDrivers'
import { ApolloSessionModel } from '../session'
import { createFetchErrorMessage } from '../util'

interface DownloadGFF3Props {
  session: ApolloSessionModel
  handleClose(): void
}

export function DownloadGFF3({ session, handleClose }: DownloadGFF3Props) {
  const [selectedAssembly, setSelectedAssembly] = useState<Assembly>()
  const [errorMessage, setErrorMessage] = useState('')

  const { collaborationServerDriver, getInternetAccount } =
    session.apolloDataStore as {
      collaborationServerDriver: CollaborationServerDriver
      getInternetAccount(
        assemblyName?: string,
        internetAccountId?: string,
      ): ApolloInternetAccount
    }
  const assemblies = collaborationServerDriver.getAssemblies()

  function handleChangeAssembly(e: SelectChangeEvent<string>) {
    const newAssembly = assemblies.find((asm) => asm.name === e.target.value)
    setSelectedAssembly(newAssembly)
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    if (!selectedAssembly) {
      setErrorMessage('Must select assembly to download')
      return
    }

    const { internetAccountConfigId } = getConf(selectedAssembly, [
      'sequence',
      'metadata',
    ]) as { internetAccountConfigId?: string }
    const internetAccount = getInternetAccount(internetAccountConfigId)
    const url = new URL('features/getExportID', internetAccount.baseURL)
    const searchParams = new URLSearchParams({
      assembly: selectedAssembly.name,
    })
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
  }

  return (
    <Dialog open maxWidth="xl" data-testid="login-apollo">
      <DialogTitle>Export GFF3</DialogTitle>
      <form onSubmit={onSubmit}>
        <DialogContent style={{ display: 'flex', flexDirection: 'column' }}>
          <DialogContentText>Select assembly</DialogContentText>
          <Select
            labelId="label"
            value={selectedAssembly?.name ?? ''}
            onChange={handleChangeAssembly}
            disabled={!assemblies.length}
          >
            {assemblies.map((option) => (
              <MenuItem key={option.name} value={option.name}>
                {option.displayName ?? option.name}
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
