/* eslint-disable @typescript-eslint/use-unknown-in-catch-callback-variable */
/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-misused-promises */
import { AddFeaturesFromFileChange } from '@apollo-annotation/shared'
import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import {
  Button,
  Checkbox,
  DialogActions,
  DialogContent,
  DialogContentText,
  FormControlLabel,
  FormHelperText,
  LinearProgress,
  MenuItem,
  Select,
  type SelectChangeEvent,
} from '@mui/material'
import React, { useEffect, useState } from 'react'

import type { ChangeManager, JobInput } from '../ChangeManager'
import type { ApolloSessionModel } from '../session'
import { createFetchErrorMessage, getApolloAssemblyId } from '../util'

import { Dialog } from './Dialog'
import type { AbstractSessionModel } from '@jbrowse/core/util'
import { readConfObject } from '@jbrowse/core/configuration'

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
  const [file, setFile] = useState<File>()
  const [selectedAssembly, setSelectedAssembly] = useState<Assembly>()
  const [errorMessage, setErrorMessage] = useState('')
  const [submitted, setSubmitted] = useState(false)
  // default is -1, submit button should be disabled until count is set
  const [featuresCount, setFeaturesCount] = useState<number | undefined>()
  const [deleteFeatures, setDeleteFeatures] = useState(false)
  const [strict, setStrict] = useState(true)
  const [loading, setLoading] = useState(false)

  const { assemblies } = (session as unknown as AbstractSessionModel)
    .assemblyManager

  function handleChangeAssembly(e: SelectChangeEvent) {
    const newAssembly = assemblies.find((asm) => asm.name === e.target.value)
    setSelectedAssembly(newAssembly)
    setSubmitted(false)
  }

  function handleDeleteFeatures(e: React.ChangeEvent<HTMLInputElement>) {
    setDeleteFeatures(e.target.checked)
  }

  function handleSetStrict(e: React.ChangeEvent<HTMLInputElement>) {
    setStrict(e.target.checked)
  }

  // fetch and set features count for selected assembly
  useEffect(() => {
    if (!selectedAssembly) {
      return
    }
    const updateFeaturesCount = async () => {
      const uri = new URL('features/count', globalThis.location.href)
      const searchParams = new URLSearchParams({
        assemblyId: getApolloAssemblyId(selectedAssembly),
      })
      uri.search = searchParams.toString()

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
  }, [session, selectedAssembly])

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

    if (!file) {
      setErrorMessage('must select a file')
      return
    }

    if (!selectedAssembly) {
      setErrorMessage('Must select assembly to download')
      return
    }

    // First upload file
    const url = new URL('files', globalThis.location.href)
    url.searchParams.set('type', 'text/x-gff3')
    const uri = url.href
    const formData = new FormData()
    formData.append('file', file)
    formData.append('fileName', file.name)
    formData.append('type', 'text/x-gff3')

    handleClose()

    const { jobStatusWidget, showJobStatusWidget } = session
    const controller = new AbortController()

    const job: JobInput = {
      name: `Importing features for ${selectedAssembly.displayName}`,
      statusMessage: 'Uploading file, this may take awhile',
      progressPct: 0,
      cancelCallback: () => {
        controller.abort(
          new DOMException(
            `Canceling importing of features to ${selectedAssembly.displayName}`,
            'AbortError',
          ),
        )
        jobStatusWidget.addJob({ name: job.name, state: 'aborted' })
      },
      state: 'running',
    }

    jobStatusWidget.addJob(job)
    showJobStatusWidget()

    const { signal } = controller
    const response = await fetch(uri, {
      method: 'POST',
      body: formData,
      signal,
    })
    if (!response.ok) {
      const newErrorMessage = await createFetchErrorMessage(
        response,
        'Error when inserting new features (while uploading file)',
      )
      jobStatusWidget.addJob({
        name: job.name,
        statusMessage: newErrorMessage,
        state: 'aborted',
      })
      setErrorMessage(newErrorMessage)
      return
    }
    const result = await response.json()
    // fileChecksum = result.checksum
    const fileId = result._id

    // Add features
    const change = new AddFeaturesFromFileChange({
      typeName: 'AddFeaturesFromFileChange',
      assembly: getApolloAssemblyId(selectedAssembly),
      fileId,
      parseOptions: { strict },
      deleteExistingFeatures: deleteFeatures,
    })

    jobStatusWidget.addJob({
      name: job.name,
      statusMessage: 'Imported features',
      state: 'finished',
    })

    await changeManager.submit(change, { updateJobStatusWidget: true })
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
            {assemblies.map((assembly) => (
              <MenuItem key={assembly.name} value={assembly.name}>
                {/* @ts-expect-error not right here */}
                {readConfObject(assembly, 'displayName') ?? assembly.name}
              </MenuItem>
            ))}
          </Select>
          <DialogContentText>Upload GFF3 to load features</DialogContentText>
          <input
            type="file"
            onChange={handleChangeFile}
            disabled={submitted && !errorMessage}
          />
          <FormControlLabel
            label="Strict parsing"
            disabled={submitted && !errorMessage}
            control={<Checkbox checked={strict} onChange={handleSetStrict} />}
          />
          <FormHelperText>
            Don&apos;t import any features if any lines in the GFF3 are unable
            to be processed
          </FormHelperText>

          {featuresCount && featuresCount > 0 ? (
            <>
              <FormControlLabel
                label="Delete existing features"
                disabled={submitted && !errorMessage}
                control={
                  <Checkbox
                    checked={deleteFeatures}
                    onChange={handleDeleteFeatures}
                    slotProps={{ input: { 'aria-label': 'controlled' } }}
                    color="warning"
                  />
                }
              />
              <FormHelperText>
                This assembly has {featuresCount} features that will be deleted
              </FormHelperText>
            </>
          ) : null}
        </DialogContent>

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
