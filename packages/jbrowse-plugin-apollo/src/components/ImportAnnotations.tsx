/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-misused-promises */
import {
  AddFeatureChange,
  gff3ToAnnotationFeature,
} from '@apollo-annotation/shared'
import { GFFTransformer } from '@gmod/gff'
import {
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
  LinearProgress,
} from '@mui/material'
import React, { useState } from 'react'

import type { ChangeManager } from '../ChangeManager'
import type { ApolloSessionModel } from '../session'

import { Dialog } from './Dialog'

interface ImportAnnotationsProps {
  session: ApolloSessionModel
  handleClose(): void
  assemblyName: string
}

export function ImportAnnotations({
  assemblyName,
  handleClose,
  session,
}: ImportAnnotationsProps) {
  const { changeManager } = session.apolloDataStore as {
    changeManager: ChangeManager
  }
  const [file, setFile] = useState<File>()
  const [errorMessage, setErrorMessage] = useState('')
  const [loading, setLoading] = useState(false)

  function handleChangeFile(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      setFile(e.target.files[0])
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!file) {
      return
    }
    setLoading(true)
    setErrorMessage('')
    try {
      const stream = file
        .stream()
        .pipeThrough(
          new TransformStream(new GFFTransformer({ parseSequences: false })),
        )
      for await (const value of stream) {
        const annotationFeature = gff3ToAnnotationFeature(value)
        const change = new AddFeatureChange({
          changedIds: [annotationFeature._id],
          typeName: 'AddFeatureChange',
          assembly: assemblyName,
          addedFeature: annotationFeature,
        })
        await changeManager.submit(change)
      }
      handleClose()
    } catch (error) {
      setErrorMessage(String(error))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open title="Import annotations" handleClose={handleClose}>
      {loading ? <LinearProgress /> : null}
      <form onSubmit={onSubmit}>
        <DialogContent>
          <DialogContentText>
            Import annotations from a GFF3 file into the current Apollo track.
            Features are parsed and stored locally in the browser, so importing
            very large GFF3 files is not recommended.
          </DialogContentText>
          <input
            type="file"
            accept=".gff,.gff3"
            onChange={handleChangeFile}
            disabled={loading}
          />
          {errorMessage ? (
            <DialogContentText color="error">{errorMessage}</DialogContentText>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button variant="contained" type="submit" disabled={!file || loading}>
            Import
          </Button>
          <Button variant="outlined" onClick={handleClose}>
            Cancel
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
