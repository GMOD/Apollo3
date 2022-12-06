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

import { ApolloInternetAccountModel } from '../ApolloInternetAccount/model'
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

    // *** ORIGINAL ***
    // const { internetAccount } = selectedAssembly
    // const url = new URL('refSeqs', internetAccount.baseURL)
    // const searchParams = new URLSearchParams({ assembly: selectedAssembly._id })
    // url.search = searchParams.toString()
    // const uri = url.toString()

    // *** WORKS WHEN GUARD AND VALIDATIONS ARE COMMENTED IN CONTROLLER i.e. no authorization header is needed
    // const { internetAccount } = selectedAssembly
    // const url = new URL('features/exportGFF3', internetAccount.baseURL)
    // const searchParams = new URLSearchParams({ assembly: selectedAssembly._id })
    // url.search = searchParams.toString()
    // const uri = url.toString()

    const apolloInternetAccount = internetAccounts.find(
      (ia) => ia.type === 'ApolloInternetAccount',
    ) as ApolloInternetAccountModel | undefined
    if (!apolloInternetAccount) {
      throw new Error('No Apollo internet account found')
    }
    const searchParams = new URLSearchParams({
      assembly: selectedAssembly._id,
    })
    const { baseURL } = apolloInternetAccount
    const url = new URL('features/exportGFF3', baseURL)
    url.search = searchParams.toString()
    const uri = url.toString()

    fetch(uri, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/text',
        Authorization: `Bearer ${apolloInternetAccount.retrieveToken()}`,
      },
    })
      .then((response) => response.blob())
      .then((blob) => {
        const url2 = window.URL.createObjectURL(blob)
        window.open(url2, '_blank')
      })

    // window.open(uri, '_blank') // ** ORIGINAL line
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
