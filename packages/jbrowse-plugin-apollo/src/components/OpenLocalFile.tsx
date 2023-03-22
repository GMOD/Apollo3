import gff, { GFF3Sequence } from '@gmod/gff'
import { GFF3Feature } from '@gmod/gff'
import { AbstractSessionModel } from '@jbrowse/core/util'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material'
import ObjectID from 'bson-objectid'
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

export interface RefSeqInterface {
  refName: string
  uniqueId: string
  aliases?: string[]
}

export interface SequenceAdapterFeatureInterface {
  refName: string
  uniqueId: string
  start: number
  end: number
  seq: string
}

export function OpenLocalFile({
  session,
  handleClose,
  changeManager,
  localFileDriver,
}: OpenLocalFileProps) {
  const { notify } = session as ApolloSessionModel

  const [file, setFile] = useState<File | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [submitted, setSubmitted] = useState(false)

  async function handleChangeFile(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) {
      return
    }
    const selectedFile = e.target.files.item(0)
    setFile(selectedFile)
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    setSubmitted(true)

    if (
      !file?.name.toLowerCase().endsWith('.gff3') &&
      !file?.name.toLowerCase().endsWith('.gff')
    ) {
      setErrorMessage('Only file with endings ".gff3" or ".gff" is accepted!')
      return
    }
    // Right now we are not using stream because there was a problem with 'pipe' in ReadStream
    const fileData = await new Response(file).text()
    const featuresAndSequences: (GFF3Feature | GFF3Sequence)[] =
      gff.parseStringSync(fileData, {
        parseSequences: true,
        parseComments: false,
        parseDirectives: false,
        parseFeatures: true,
      })
    const tempAssembly = 'Assembly-2'

    // let fastaInfoStarted = false
    // eslint-disable-next-line prefer-const
    let refsArray: RefSeqInterface[] = []
    const sequenceAdapterFeatures: SequenceAdapterFeatureInterface[] = []
    for (const seqLine of featuresAndSequences) {
      if (!Array.isArray(seqLine)) {
        const newRefSeqDocId = new ObjectID().toHexString()

        sequenceAdapterFeatures.push({
          refName: seqLine.id,
          uniqueId: `${tempAssembly}-${seqLine.id}`,
          start: 0,
          end: seqLine.sequence.length,
          seq: seqLine.sequence,
        })
        refsArray.push({
          refName: seqLine.id,
          aliases: [newRefSeqDocId],
          uniqueId: `alias-${newRefSeqDocId}`,
        })
      }
    }

    const features = featuresAndSequences.filter((featuresOrSequences) =>
      Array.isArray(featuresOrSequences),
    ) as GFF3Feature[]
    await localFileDriver.saveFeatures(
      features,
      tempAssembly,
      session as ApolloSessionModel,
      refsArray,
      sequenceAdapterFeatures,
    )
    notify(`Assembly and features are being added to local data store`, 'info')
    handleClose()
    event.preventDefault()
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
