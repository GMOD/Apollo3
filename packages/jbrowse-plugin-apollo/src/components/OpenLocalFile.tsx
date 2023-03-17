import type { ReadStream } from 'fs'

import gff from '@gmod/gff'
import { GFF3Feature } from '@gmod/gff'
import { AbstractSessionModel, AppRootModel } from '@jbrowse/core/util'
import { storeBlobLocation } from '@jbrowse/core/util/tracks'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material'
import { ClientDataStore } from 'apollo-common'
import { getRoot, IAnyStateTreeNode } from 'mobx-state-tree'
import React, { useState } from 'react'

import { LocalFileDriver } from '../BackendDrivers'
import { ChangeManager } from '../ChangeManager'
import { ApolloSessionModel } from '../session'

interface OpenLocalFileProps {
  session: AbstractSessionModel
  handleClose(): void
  changeManager: ChangeManager
  localFileDriver: LocalFileDriver
}

export function OpenLocalFile({
  session,
  handleClose,
  changeManager,
  localFileDriver,
}: OpenLocalFileProps) {
  const { notify, apolloDataStore } = session as ApolloSessionModel

  const [file, setFile] = useState<File>()
  const [errorMessage, setErrorMessage] = useState('')
  const [submitted, setSubmitted] = useState(false)

  async function handleChangeFile(e: React.ChangeEvent<HTMLInputElement>) {
    const uploadedFile = e.target && e.target.files && e.target.files[0]
    if (uploadedFile) {
      const fileData = await new Response(uploadedFile).text()

      // THIS CAUSES ERROR
      // const featuresFailed = parseGFF3(fileData as unknown as ReadStream)
      //  OpenLocalFile.tsx:75 Uncaught (in promise) TypeError: stream.pipe is not a function

      
      const features: GFF3Feature[] = gff.parseStringSync(fileData, {
        parseSequences: false,
        parseComments: false,
        parseDirectives: false,
        parseFeatures: true,
      })

      // const dataStore = apolloDataStore as ClientDataStore & IAnyStateTreeNode
      localFileDriver.saveFeatures(features, 'Jeplis 7', (session as ApolloSessionModel))
    }

    setSubmitted(false)
    if (!e.target.files) {
      return
    }
    setFile(e.target.files[0])
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    notify(`Features are being added to local data store`, 'info')
    handleClose()
    event.preventDefault()
  }

  function parseGFF3(stream: ReadStream) {
    return stream.pipe(
      gff.parseStream({
        parseSequences: false,
        parseComments: false,
        parseDirectives: false,
        parseFeatures: true,
      }),
    )
  }
  return (
    <Dialog open maxWidth="xl" data-testid="login-apollo">
      <DialogTitle>Open local GFF3 file</DialogTitle>
      <form onSubmit={onSubmit}>
        <DialogContent style={{ display: 'flex', flexDirection: 'column' }}>
          <DialogContentText>GFF3 with embedded FASTA</DialogContentText>
          <input
            type="file"
            onChange={handleChangeFile}
            disabled={submitted && !errorMessage}
          />

          {/* <Button variant="outlined" component="label">
            Choose File
            <input
              type="file"
              hidden
              onChange={({ target }) => {
                const file2 = target && target.files && target.files[0]
                if (file2) {
                  storeBlobLocation({ blob: file2 })
                }
              }}
            />
          </Button> */}
        </DialogContent>
        <DialogActions>
          <Button disabled={!file} variant="contained" type="submit">
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
