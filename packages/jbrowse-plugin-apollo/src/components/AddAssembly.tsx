import { Buffer } from 'buffer'

import { AbstractSessionModel, AppRootModel } from '@jbrowse/core/util'
import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormLabel,
  Radio,
  RadioGroup,
  TextField,
} from '@mui/material'
import { getRoot } from 'mobx-state-tree'
import React, { useState } from 'react'

import { ApolloInternetAccountModel } from '../ApolloInternetAccount/model'

interface AddAssemblyProps {
  session: AbstractSessionModel
  handleClose(): void
}

export function AddAssembly({ session, handleClose }: AddAssemblyProps) {
  const { internetAccounts } = getRoot(session) as AppRootModel
  const { notify } = session
  const apolloInternetAccount = internetAccounts.find(
    (ia) => ia.type === 'ApolloInternetAccount',
  ) as ApolloInternetAccountModel | undefined
  if (!apolloInternetAccount) {
    throw new Error('No Apollo internet account found')
  }
  const { baseURL } = apolloInternetAccount
  const [assemblyName, setAssemblyName] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [file, setFile] = useState<File>()
  const [fileType, setFileType] = useState('text/x-gff3')
  const [importFeatures, setImportFeatures] = useState(true)

  function handleChangeFile(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) {
      return
    }
    setFile(e.target.files[0])
  }

  function handleChangeFileType(e: React.ChangeEvent<HTMLInputElement>) {
    setFileType(e.target.value)
    if (e.target.value !== 'text/x-gff3') {
      setImportFeatures(false)
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    // let fileChecksum = ''
    let fileId = ''
    let msg
    if (!file) {
      throw new Error('must select a file')
    }

    // First upload file
    const url = new URL('/files', baseURL).href
    const formData = new FormData()
    formData.append('file', file)
    formData.append('fileName', file.name)
    formData.append('type', fileType)
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
          `Error when inserting new assembly (while uploading file) — ${
            res.status
          } (${res.statusText})${msg ? ` (${msg})` : ''}`,
        )
        return
      }
      const result = await res.json()
      fileId = result._id
    }

    let typeName = 'AddAssemblyFromFileChange'
    if (fileType === 'text/x-gff3' && importFeatures) {
      typeName = 'AddAssemblyAndFeaturesFromFileChange'
    }

    // Add assembly and refSeqs
    const uri = new URL('/changes/submitChange', baseURL).href
    const apolloFetch = apolloInternetAccount?.getFetcher({
      locationType: 'UriLocation',
      uri,
    })
    if (apolloFetch) {
      const res = await apolloFetch(uri, {
        method: 'POST',
        body: JSON.stringify({
          changedIds: ['1'],
          typeName,
          assemblyId: generateObjectId(),
          fileId,
          assemblyName,
        }),
        headers: new Headers({
          'Content-Type': 'application/json',
        }),
      })
      if (!res.ok) {
        try {
          msg = await res.text()
        } catch (e) {
          msg = ''
        }
        setErrorMessage(
          `Error when inserting new assembly — ${res.status} (${
            res.statusText
          })${msg ? ` (${msg})` : ''}`,
        )
        // Let's delete the uploaded file
        const deleteFileUri = new URL(`/files/${fileId}`, baseURL).href
        const apolloDeleteFile = apolloInternetAccount?.getFetcher({
          locationType: 'UriLocation',
          uri: deleteFileUri,
        })
        if (apolloDeleteFile) {
          const resDeleteFile = await apolloDeleteFile(deleteFileUri, {
            method: 'DELETE',
          })
          if (!resDeleteFile.ok) {
            try {
              msg = await resDeleteFile.text()
            } catch (e) {
              msg = ''
            }
            setErrorMessage(
              `Error when deleting uploaded file after unsuccessfully inserting assembly — ${
                resDeleteFile.status
              } (${resDeleteFile.statusText})${msg ? ` (${msg})` : ''}`,
            )
          }
        }
        return
      }
    }
    notify(`Assembly "${assemblyName}" added successfully`, 'success')
    handleClose()
    event.preventDefault()
  }

  return (
    <Dialog open maxWidth="xl" data-testid="login-apollo">
      <DialogTitle>Add new assembly</DialogTitle>
      <form onSubmit={onSubmit}>
        <DialogContent style={{ display: 'flex', flexDirection: 'column' }}>
          <TextField
            autoFocus
            margin="dense"
            id="name"
            label="Assembly name"
            type="TextField"
            fullWidth
            variant="outlined"
            onChange={(e) => setAssemblyName(e.target.value)}
          />
          <FormControl>
            <FormLabel>Select GFF3 or FASTA file</FormLabel>
            <RadioGroup
              aria-labelledby="demo-radio-buttons-group-label"
              defaultValue="text/x-gff3"
              name="radio-buttons-group"
              onChange={handleChangeFileType}
            >
              <FormControlLabel
                value="text/x-gff3"
                control={<Radio />}
                label="GFF3"
              />
              <FormControlLabel
                value="text/x-fasta"
                control={<Radio />}
                label="FASTA"
              />
            </RadioGroup>
          </FormControl>
          <input type="file" onChange={handleChangeFile} />
          <FormGroup>
            <FormControlLabel
              control={
                <Checkbox
                  checked={importFeatures}
                  onChange={() => setImportFeatures(!importFeatures)}
                  disabled={fileType !== 'text/x-gff3'}
                />
              }
              label="Also load features from GFF3 file"
            />
          </FormGroup>
        </DialogContent>
        <DialogActions>
          <Button
            disabled={!(assemblyName && file)}
            variant="contained"
            type="submit"
          >
            Submit
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

let index = Math.floor(Math.random() * 0xffffff)

function getInc(): number {
  return (index = (index + 1) % 0xffffff)
}

/**
 * Generate a 12 byte id buffer used in ObjectId's
 *
 * @param time - pass in a second based timestamp.
 */
function generateObjectId(time?: number): Buffer {
  if ('number' !== typeof time) {
    time = Math.floor(Date.now() / 1000)
  }

  const inc = getInc()
  const buffer = Buffer.alloc(12)

  // 4-byte timestamp
  buffer.writeUInt32BE(time, 0)

  // // set PROCESS_UNIQUE if yet not initialized
  // if (PROCESS_UNIQUE === null) {
  //   PROCESS_UNIQUE = randomBytes(5)
  // }

  const PROCESS_UNIQUE = window.crypto.getRandomValues(Buffer.alloc(5))

  // 5-byte process unique
  ;[buffer[4], buffer[5], buffer[6], buffer[7], buffer[8]] = PROCESS_UNIQUE

  // 3-byte counter
  buffer[11] = inc & 0xff
  buffer[10] = (inc >> 8) & 0xff
  buffer[9] = (inc >> 16) & 0xff

  return buffer
}
