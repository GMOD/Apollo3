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
import { AddFeaturesFromFileChange, ChangeManager } from 'apollo-shared'
import { getRoot } from 'mobx-state-tree'
import React, { useState } from 'react'

import { useAssemblies } from './'

interface ImportFeaturesProps {
  session: AbstractSessionModel
  handleClose(): void
  changeManager: ChangeManager
}

export function ImportFeatures({
  session,
  handleClose,
  changeManager,
}: ImportFeaturesProps) {
  const { internetAccounts } = getRoot(session) as AppRootModel
  const { notify } = session

  const [assemblyName, setAssemblyName] = useState('')
  const [file, setFile] = useState<File>()
  const [assemblyId, setAssemblyId] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [submitted, setSubmitted] = useState(false)

  function handleChangeAssembly(e: SelectChangeEvent<string>) {
    setSubmitted(false)
    setAssemblyId(e.target.value as string)
    setAssemblyName(
      assemblies.find((i) => i._id === e.target.value)?.name as string,
    )
  }

  function handleChangeFile(e: React.ChangeEvent<HTMLInputElement>) {
    setSubmitted(false)
    if (!e.target.files) {
      return
    }
    setFile(e.target.files[0])
  }

  const assemblies = useAssemblies(internetAccounts, setErrorMessage)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    // let fileChecksum = ''
    let fileId = ''
    let msg

    if (!file) {
      throw new Error('must select a file')
    }

    const assembly = assemblies.find((asm) => asm.name === assemblyName)
    if (!assembly) {
      throw new Error(`No assembly found with name ${assemblyName}`)
    }
    const { internetAccount: apolloInternetAccount } = assembly
    const { baseURL } = apolloInternetAccount

    // First upload file
    const url = new URL('/files', baseURL).href
    const formData = new FormData()
    formData.append('file', file)
    formData.append('fileName', file.name)
    formData.append('type', 'text/x-gff3')
    const apolloFetchFile = apolloInternetAccount?.getFetcher({
      locationType: 'UriLocation',
      uri: url,
    })
    if (apolloFetchFile) {
      const res = await apolloFetchFile(url, {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        try {
          msg = await res.text()
        } catch (e) {
          msg = ''
        }
        setErrorMessage(
          `Error when inserting new features (while uploading file) — ${
            res.status
          } (${res.statusText})${msg ? ` (${msg})` : ''}`,
        )
        return
      }
      const result = await res.json()
      // fileChecksum = result.checksum
      fileId = result._id
    }

    // Add features
    const change = new AddFeaturesFromFileChange({
      changedIds: ['1'],
      typeName: 'AddFeaturesFromFileChange',
      assemblyId,
      fileId,
    })
    changeManager.submit(change)
    notify(`Features are being added to "${assemblyName}"`, 'info')
    handleClose()
    event.preventDefault()
  }

  return (
    <Dialog open maxWidth="xl" data-testid="login-apollo">
      <DialogTitle>Import Features from GFF3 file</DialogTitle>
      <form onSubmit={onSubmit}>
        <DialogContent style={{ display: 'flex', flexDirection: 'column' }}>
          <DialogContentText>Select assembly</DialogContentText>
          <Select
            labelId="label"
            value={assemblyId}
            onChange={handleChangeAssembly}
            disabled={submitted && !errorMessage}
          >
            {assemblies.map((option) => (
              <MenuItem key={option._id} value={option._id}>
                {option.name}
              </MenuItem>
            ))}
          </Select>
          <DialogContentText>Upload GFF3 to load features</DialogContentText>
          <input
            type="file"
            onChange={handleChangeFile}
            disabled={submitted && !errorMessage}
          />
        </DialogContent>
        <DialogActions>
          <Button
            disabled={!(assemblyId && file)}
            variant="contained"
            type="submit"
          >
            {submitted ? 'Submitting...' : 'Submit'}
          </Button>
          <Button
            disabled={submitted}
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
