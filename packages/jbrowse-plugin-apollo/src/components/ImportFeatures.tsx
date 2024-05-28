/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-misused-promises */
import { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import { getConf } from '@jbrowse/core/configuration'
import {
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
  MenuItem,
  Select,
  SelectChangeEvent,
} from '@mui/material'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import LinearProgress from '@mui/material/LinearProgress'
import { AddFeaturesFromFileChange } from 'apollo-shared'
import React, { useEffect, useState } from 'react'

import {
  ApolloInternetAccount,
  CollaborationServerDriver,
} from '../BackendDrivers'
import { ChangeManager } from '../ChangeManager'
import { ApolloSessionModel } from '../session'
import { createFetchErrorMessage } from '../util'
import { Dialog } from './Dialog'

interface ImportFeaturesProps {
  session: ApolloSessionModel
  handleClose(): void
  changeManager: ChangeManager
}

export function ImportFeatures({
  changeManager,
  handleClose,
  session,
}: ImportFeaturesProps) {
  const { apolloDataStore } = session

  const [file, setFile] = useState<File>()
  const [selectedAssembly, setSelectedAssembly] = useState<Assembly>()
  const [errorMessage, setErrorMessage] = useState('')
  const [submitted, setSubmitted] = useState(false)
  // default is -1, submit button should be disabled until count is set
  const [featuresCount, setFeaturesCount] = useState<number | undefined>()
  const [deleteFeatures, setDeleteFeatures] = useState(false)
  const [loading, setLoading] = useState(false)

  const { collaborationServerDriver, getInternetAccount } = apolloDataStore as {
    collaborationServerDriver: CollaborationServerDriver
    getInternetAccount(
      assemblyName?: string,
      internetAccountId?: string,
    ): ApolloInternetAccount
  }
  const assemblies = collaborationServerDriver.getAssemblies()

  function handleChangeAssembly(e: SelectChangeEvent) {
    const newAssembly = assemblies.find((asm) => asm.name === e.target.value)
    setSelectedAssembly(newAssembly)
    setSubmitted(false)
  }

  function handleDeleteFeatures(e: React.ChangeEvent<HTMLInputElement>) {
    setDeleteFeatures(e.target.checked)
  }

  // fetch and set features count for selected assembly
  useEffect(() => {
    if (!selectedAssembly) {
      return
    }
    const updateFeaturesCount = async () => {
      // TODO: this code will not work for running on desktop
      const { internetAccountConfigId } = getConf(selectedAssembly, [
        'sequence',
        'metadata',
      ]) as { internetAccountConfigId?: string }
      const apolloInternetAccount = getInternetAccount(
        selectedAssembly.name,
        internetAccountConfigId,
      )
      if (!apolloInternetAccount) {
        throw new Error('No Apollo internet account found')
      }

      const { baseURL } = apolloInternetAccount
      const uri = new URL('/features/count', baseURL)
      const searchParams = new URLSearchParams({
        assemblyId: selectedAssembly.name,
      })
      uri.search = searchParams.toString()
      const fetch = apolloInternetAccount.getFetcher({
        locationType: 'UriLocation',
        uri: uri.toString(),
      })

      setLoading(true)
      const response = await fetch(uri.toString(), { method: 'GET' })

      if (response.ok) {
        const countObj = (await response.json()) as { count: number }
        setFeaturesCount(countObj.count)
      } else {
        throw new Error(await createFetchErrorMessage(response))
      }

      setLoading(false)
    }

    updateFeaturesCount().catch((error) => {
      console.error(error)
      setErrorMessage(error.message ?? error)
    })
  }, [getInternetAccount, session, selectedAssembly])

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
      setErrorMessage('must select a file')
      return
    }

    if (!selectedAssembly) {
      setErrorMessage('Must select assembly to download')
      return
    }

    const { internetAccountConfigId } = getConf(selectedAssembly, [
      'sequence',
      'metadata',
    ]) as { internetAccountConfigId?: string }
    const apolloInternetAccount = getInternetAccount(
      selectedAssembly.name,
      internetAccountConfigId,
    )
    const { baseURL } = apolloInternetAccount

    // First upload file
    const url = new URL('/files', baseURL).href
    const formData = new FormData()
    formData.append('file', file)
    formData.append('fileName', file.name)
    formData.append('type', 'text/x-gff3')
    const apolloFetchFile = apolloInternetAccount.getFetcher({
      locationType: 'UriLocation',
      uri: url,
    })

    handleClose()

    const { jobsManager } = session
    const controller = new AbortController()

    const job = {
      name: `Importing features for ${selectedAssembly.displayName}`,
      statusMessage: 'Uploading file, this may take awhile',
      progressPct: 0,
      cancelCallback: () => {
        controller.abort()
        jobsManager.abortJob(job.name)
      },
    }

    jobsManager.runJob(job)

    if (apolloFetchFile) {
      const { signal } = controller
      const response = await apolloFetchFile(url, {
        method: 'POST',
        body: formData,
        signal,
      })
      if (!response.ok) {
        const newErrorMessage = await createFetchErrorMessage(
          response,
          'Error when inserting new features (while uploading file)',
        )
        jobsManager.abortJob(job.name, newErrorMessage)
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
      assembly: selectedAssembly.name,
      fileId,
      deleteExistingFeatures: deleteFeatures,
    })

    jobsManager.done(job)

    await changeManager.submit(change, { updateJobsManager: true })
  }

  return (
    <Dialog
      open
      title="Import Features from GFF3 file"
      handleClose={handleClose}
      maxWidth={false}
      data-testid="import-features-dialog"
    >
      {loading ? <LinearProgress /> : null}

      <form onSubmit={onSubmit}>
        <DialogContent style={{ display: 'flex', flexDirection: 'column' }}>
          <DialogContentText>Select assembly</DialogContentText>
          <Select
            labelId="label"
            value={selectedAssembly?.name ?? ''}
            onChange={handleChangeAssembly}
            disabled={submitted && !errorMessage}
          >
            {assemblies.map((option) => (
              <MenuItem key={option.name} value={option.name}>
                {option.displayName ?? option.name}
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

        {featuresCount && featuresCount > 0 ? (
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
              !(selectedAssembly && file && featuresCount !== undefined) ||
              submitted
            }
            variant="contained"
            type="submit"
          >
            {submitted ? 'Submitting...' : 'Submit'}
          </Button>
          <Button variant="outlined" type="submit" onClick={handleClose}>
            Close
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
