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
import ObjectID from 'bson-objectid'
import { IAnyStateTreeNode, getRoot } from 'mobx-state-tree'
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

export function OpenLocalFile({
  session,
  handleClose,
  changeManager,
  localFileDriver,
}: OpenLocalFileProps) {
  const { notify } = session as ApolloSessionModel

  const [file, setFile] = useState<File>()
  const [errorMessage, setErrorMessage] = useState('')
  const [submitted, setSubmitted] = useState(false)

  async function handleChangeFile(e: React.ChangeEvent<HTMLInputElement>) {
    const uploadedFile = e.target && e.target.files && e.target.files[0]
    if (uploadedFile) {
      const fileData = await new Response(uploadedFile).text()

      // THIS CAUSES ERROR
      // const featuresFailed = parseGFF3(fileData as unknown as ReadStream)
      //  OpenLocalFile.tsx: Uncaught (in promise) TypeError: stream.pipe is not a function

      const features: GFF3Feature[] = gff.parseStringSync(fileData, {
        parseSequences: false,
        parseComments: false,
        parseDirectives: false,
        parseFeatures: true,
      })

      // ******** BEGIN *********
      let fastaInfoStarted = false // fileDoc.type !== 'text/x-gff3'
      let parsingStarted = false
      const sequenceBuffer = ''
      let incompleteLine = ''
      const lastLineIsIncomplete = true
      // eslint-disable-next-line prefer-const
      let refsArray: RefSeqInterface[] = []
      // for await (const data of sequenceStream) {
      //   const chunk = data.toString()
      //   lastLineIsIncomplete = !chunk.endsWith('\n')
      // chunk is small enough that you can split the whole thing into lines without having to make it into smaller chunks first.
      const lines = fileData.split(/\r?\n/)
      if (incompleteLine) {
        lines[0] = `${incompleteLine}${lines[0]}`
        incompleteLine = ''
      }
      if (lastLineIsIncomplete) {
        incompleteLine = lines.pop() || ''
      }
      for await (const line of lines) {
        // In case of GFF3 file we start to read sequence after '##FASTA' is found
        if (!fastaInfoStarted) {
          if (line.trim() === '##FASTA') {
            fastaInfoStarted = true
          }
          continue
        }
        const refSeqInfoLine = /^>\s*(\S+)\s*(.*)/.exec(line)
        // Add new ref sequence infor if we are reference seq info line
        if (refSeqInfoLine) {
          parsingStarted = true

          // // If there is sequence from previous reference sequence then we need to add it to previous ref seq
          // if (sequenceBuffer !== '') {
          //   if (!refSeqDoc) {
          //     throw new Error('No refSeq document found')
          //   }
          //   refSeqLen += sequenceBuffer.length
          //   logger.debug?.(
          //     `Creating refSeq chunk number ${chunkIndex} of "${refSeqDoc._id}"`,
          //   )
          //   // We cannot use Mongo 'session' / transaction here because Mongo has 16 MB limit for transaction
          //   await refSeqChunkModel.create([
          //     {
          //       refSeq: refSeqDoc._id,
          //       n: chunkIndex,
          //       sequence: sequenceBuffer,
          //       user,
          //       status: -1,
          //     },
          //   ])
          //   sequenceBuffer = ''
          // }
          // await refSeqDoc?.updateOne({ length: refSeqLen })
          // // await refSeqDoc?.updateOne({ length: refSeqLen }, { session })
          // refSeqLen = 0
          // chunkIndex = 0

          const name = refSeqInfoLine[1].trim()
          const description = refSeqInfoLine[2] ? refSeqInfoLine[2].trim() : ''

          const newRefSeqDocId = new ObjectID().toHexString()
          refsArray.push({refName:name, aliases:[newRefSeqDocId],uniqueId:`alias-`+newRefSeqDocId})
          // refSeqDoc = newRefSeqDoc
        } else if (/\S/.test(line)) {
          // if (!refSeqDoc) {
          //   throw new Error('No refSeq document found')
          // }
          // const { chunkSize } = refSeqDoc
          // sequenceBuffer += line.replace(/\s/g, '')
          // // If sequence block > chunk size then save chunk into Mongo
          // while (sequenceBuffer.length >= chunkSize) {
          //   const sequence = sequenceBuffer.slice(0, chunkSize)
          //   refSeqLen += sequence.length
          //   logger.debug?.(
          //     `Creating refSeq chunk number ${chunkIndex} of "${refSeqDoc._id}"`,
          //   )
          //   // We cannot use Mongo 'session' / transaction here because Mongo has 16 MB limit for transaction
          //   await refSeqChunkModel.create([
          //     {
          //       refSeq: refSeqDoc._id,
          //       n: chunkIndex,
          //       sequence,
          //       user,
          //       status: -1,
          //     },
          //   ])
          //   chunkIndex++
          //   // Set remaining sequence
          //   sequenceBuffer = sequenceBuffer.slice(chunkSize)
          //   logger.debug?.(`Remaining sequence: "${sequenceBuffer}"`)
          // }
        }
      }
      // }
      // ********** END *************
      const tempAssembly = 'Assembly-08'
      localFileDriver.saveFeatures(features, tempAssembly, (session as ApolloSessionModel), refsArray)
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
