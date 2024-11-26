/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/no-misused-promises */
import { AbstractSessionModel, isElectron } from '@jbrowse/core/util'
import {
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
  FormControl,
  FormHelperText,
  TextField,
  useTheme,
} from '@mui/material'
import { nanoid } from 'nanoid'
import React, { useState } from 'react'

import { InMemoryFileDriver } from '../BackendDrivers'
import { ApolloSessionModel } from '../session'
import { loadAssemblyIntoClient } from '../util'
import { Dialog } from './Dialog'

interface OpenLocalFileProps {
  session: ApolloSessionModel
  handleClose(): void
  inMemoryFileDriver: InMemoryFileDriver
}

export interface RefSeqInterface {
  refName: string
  uniqueId: string
  aliases?: string[]
}

export function OpenLocalFile({ handleClose, session }: OpenLocalFileProps) {
  const { apolloDataStore } = session
  const { addAssembly, addSessionAssembly, assemblyManager, notify } =
    session as unknown as AbstractSessionModel & {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
      addSessionAssembly: Function
    }

  const [file, setFile] = useState<File | null>(null)
  const [assemblyName, setAssemblyName] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const theme = useTheme()

  function handleChangeFile(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.item(0)
    if (!selectedFile) {
      return
    }
    setErrorMessage('')
    setFile(selectedFile)
    if (!assemblyName) {
      const fileName = selectedFile.name
      const lastDotIndex = fileName.lastIndexOf('.')
      if (lastDotIndex === -1) {
        setAssemblyName(fileName)
      } else {
        setAssemblyName(fileName.slice(0, lastDotIndex))
      }
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    setSubmitted(true)

    if (!file) {
      throw new Error('No file selected')
    }

    // Right now we are not using stream because there was a problem with 'pipe' in ReadStream
    const fileData = await new Response(file).text()
    const assemblyId = `${assemblyName}-${file.name}-${nanoid(8)}`
    try {
      await loadAssemblyIntoClient(assemblyId, fileData, apolloDataStore)
    } catch (error) {
      console.error(error)
      notify(`Error loading GFF3 ${file.name}, ${String(error)}`, 'error')
      handleClose()
      return
    }

    const assemblyConfig = {
      name: assemblyId,
      aliases: [assemblyName],
      displayName: assemblyName,
      sequence: {
        trackId: `sequenceConfigId-${assemblyName}`,
        type: 'ReferenceSequenceTrack',
        adapter: { type: 'ApolloSequenceAdapter', assemblyId },
        metadata: {
          apollo: true,
          ...(isElectron
            ? { file: (file as File & { path: string }).path }
            : {}),
        },
      },
    }

    // Save assembly into session
    await (addSessionAssembly || addAssembly)(assemblyConfig)
    const a = await assemblyManager.waitForAssembly(assemblyConfig.name)
    if (a) {
      // @ts-expect-error MST type coercion problem?
      session.addApolloTrackConfig(a)
      notify(`Loaded GFF3 ${file.name}`, 'success')
    } else {
      notify(`Error loading GFF3 ${file.name}`, 'error')
    }
    handleClose()
  }

  function handleAssemblyNameChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    setAssemblyName(event.target.value)
  }

  return (
    <Dialog
      open
      title="Open local GFF3 file"
      handleClose={handleClose}
      maxWidth={false}
      data-testid="open-local-file"
    >
      <form onSubmit={onSubmit}>
        <DialogContent style={{ display: 'flex', flexDirection: 'column' }}>
          <FormControl>
            <div style={{ flexDirection: 'row' }}>
              <Button
                variant="contained"
                component="label"
                style={{ marginRight: theme.spacing() }}
              >
                Choose File
                <input
                  type="file"
                  required
                  hidden
                  onChange={handleChangeFile}
                />
              </Button>
              {file ? file.name : 'No file chosen'}
            </div>
            <FormHelperText>
              Make sure your GFF3 has an embedded FASTA section
            </FormHelperText>
          </FormControl>
          <TextField
            required
            label="Assembly name"
            value={assemblyName}
            onChange={handleAssemblyNameChange}
          />
        </DialogContent>
        <DialogActions>
          <Button disabled={false} variant="contained" type="submit">
            {submitted ? 'Submitting...' : 'Submit'}
          </Button>
          <Button
            disabled={submitted}
            variant="outlined"
            type="submit"
            onClick={handleClose}
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
