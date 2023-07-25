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
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import LinearProgress from '@mui/material/LinearProgress'
import { AddFeaturesFromFileChange } from 'apollo-shared'
import { getRoot } from 'mobx-state-tree'
import React, { useEffect, useState } from 'react'

import { ChangeManager } from '../ChangeManager'
import { createFetchErrorMessage } from '../util'
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
  // default is -1, submit button should be disabled until count is set
  const [featuresCount, setFeaturesCount] = useState(-1)
  const [deleteFeatures, setDeleteFeatures] = useState(false)
  const [loading, setLoading] = useState(false)

  const assemblies = useAssemblies(internetAccounts, setErrorMessage)

  function handleChangeAssembly(e: SelectChangeEvent<string>) {
    setSubmitted(false)
    setAssemblyId(e.target.value as string)
    setAssemblyName(
      assemblies.find((i) => i._id === e.target.value)?.name as string,
    )
  }

  function handleDeleteFeatures(e: React.ChangeEvent<HTMLInputElement>) {
    setDeleteFeatures(e.target.checked)
  }

  // fetch and set features count for selected assembly
  useEffect(() => {
    const updateFeaturesCount = async () => {
      const assembly = assemblies.find((asm) => asm._id === assemblyId)
      if (!assembly) {
        throw new Error(`No assembly found with id ${assemblyId}`)
      }
      const { internetAccount: apolloInternetAccount } = assembly
      if (!apolloInternetAccount) {
        throw new Error('No Apollo internet account found')
      }

      const { baseURL } = apolloInternetAccount
      const uri = new URL('/features/count', baseURL)
      const searchParams = new URLSearchParams({
        assemblyId,
      })
      uri.search = searchParams.toString()
      const fetch = apolloInternetAccount?.getFetcher({
        locationType: 'UriLocation',
        uri: uri.toString(),
      })

      if (fetch) {
        // sumbit might get enabled when we change assembly before loading features count
        setFeaturesCount(-1)
        setLoading(true)
        const response = await fetch(uri, {
          method: 'GET',
        })

        if (!response.ok) {
          setFeaturesCount(0)
        } else {
          const countObj = (await response.json()) as { count: number }
          setFeaturesCount(countObj.count)
        }

        setLoading(false)
      }
    }

    if (assemblyId) {
      updateFeaturesCount().catch((err) => err)
    }
  }, [assemblies, assemblyId])

  function handleChangeFile(e: React.ChangeEvent<HTMLInputElement>) {
    setSubmitted(false)
    if (!e.target.files) {
      return
    }
    setFile(e.target.files[0])
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    setLoading(true)
    setSubmitted(true)

    // let fileChecksum = ''
    let fileId = ''

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
      const response = await apolloFetchFile(url, {
        method: 'POST',
        body: formData,
      })
      if (!response.ok) {
        const newErrorMessage = await createFetchErrorMessage(
          response,
          'Error when inserting new features (while uploading file)',
        )
        setErrorMessage(newErrorMessage)
        return
      }
      const result = await response.json()
      // fileChecksum = result.checksum
      fileId = result._id
    }

    // Add features
    const change = new AddFeaturesFromFileChange({
      typeName: 'AddFeaturesFromFileChange',
      assembly: assemblyId,
      fileId,
      deleteExistingFeatures: deleteFeatures,
    })
    await changeManager.submit(change)
    notify(`Features are being added to "${assemblyName}"`, 'info')
    handleClose()
    event.preventDefault()
  }

  return (
    <Dialog open maxWidth="xs" data-testid="login-apollo" fullWidth={true}>
      <DialogTitle>Import Features from GFF3 file</DialogTitle>
      {loading ? <LinearProgress /> : null}

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
        </DialogContent>
        <DialogContent style={{ display: 'flex', flexDirection: 'column' }}>
          <DialogContentText>Upload GFF3 to load features</DialogContentText>
          <input
            type="file"
            onChange={handleChangeFile}
            disabled={submitted && !errorMessage}
          />
        </DialogContent>

        {featuresCount > 0 ? (
          <DialogContent>
            <DialogContentText>
              This assembly already has {featuresCount} features, would you like
              to delete the existing features before importing new ones?
            </DialogContentText>
            <FormControlLabel
              label="Yes, delete existing features"
              disabled={submitted && !errorMessage}
              control={
                <Checkbox
                  checked={deleteFeatures}
                  onChange={handleDeleteFeatures}
                  inputProps={{ 'aria-label': 'controlled' }}
                  color="warning"
                />
              }
            />
          </DialogContent>
        ) : null}

        <DialogActions>
          <Button
            disabled={
              !(assemblyId && file && featuresCount !== -1) || submitted
            }
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
