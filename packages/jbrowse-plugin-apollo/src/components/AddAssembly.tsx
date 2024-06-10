/* eslint-disable @typescript-eslint/no-unsafe-enum-comparison */
/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-misused-promises */
import {
  AddAssemblyAndFeaturesFromFileChange,
  AddAssemblyFromExternalChange,
  AddAssemblyFromFileChange,
} from '@apollo-annotation/shared'
import { readConfObject } from '@jbrowse/core/configuration'
import { AbstractSessionModel } from '@jbrowse/core/util'
import LinkIcon from '@mui/icons-material/Link'
import {
  Box,
  Button,
  Checkbox,
  DialogActions,
  DialogContent,
  DialogContentText,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  SelectChangeEvent,
  TextField,
  Typography,
} from '@mui/material'
import InputAdornment from '@mui/material/InputAdornment'
import LinearProgress from '@mui/material/LinearProgress'
import ObjectID from 'bson-objectid'
import { getRoot } from 'mobx-state-tree'
import React, { useState } from 'react'

import { ApolloInternetAccountModel } from '../ApolloInternetAccount/model'
import { ChangeManager } from '../ChangeManager'
import { ApolloSessionModel } from '../session'
import { ApolloRootModel } from '../types'
import { createFetchErrorMessage } from '../util'
import { Dialog } from './Dialog'

interface AddAssemblyProps {
  session: ApolloSessionModel
  handleClose(): void
  changeManager: ChangeManager
}

enum FileType {
  GFF3 = 'text/x-gff3',
  FASTA = 'text/x-fasta',
  EXTERNAL = 'text/x-external',
}

export function AddAssembly({
  changeManager,
  handleClose,
  session,
}: AddAssemblyProps) {
  const { internetAccounts } = getRoot<ApolloRootModel>(session)
  const { notify } = session as unknown as AbstractSessionModel
  const apolloInternetAccounts = internetAccounts.filter(
    (ia) => ia.type === 'ApolloInternetAccount',
  ) as ApolloInternetAccountModel[]
  if (apolloInternetAccounts.length === 0) {
    throw new Error('No Apollo internet account found')
  }
  const [assemblyName, setAssemblyName] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [validAsm, setValidAsm] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [fileType, setFileType] = useState(FileType.GFF3)
  const [importFeatures, setImportFeatures] = useState(true)
  const [submitted, setSubmitted] = useState(false)
  const [selectedInternetAccount, setSelectedInternetAccount] = useState(
    apolloInternetAccounts[0],
  )
  const [fastaFile, setFastaFile] = useState('')
  const [fastaIndexFile, setFastaIndexFile] = useState('')
  const [fastaGziIndexFile, setFastaGziIndexFile] = useState('')
  const [loading, setLoading] = useState(false)

  function handleChangeInternetAccount(e: SelectChangeEvent) {
    setSubmitted(false)
    const newlySelectedInternetAccount = apolloInternetAccounts.find(
      (ia) => ia.internetAccountId === e.target.value,
    )
    if (!newlySelectedInternetAccount) {
      throw new Error(
        `Could not find internetAccount with ID "${e.target.value}"`,
      )
    }
    setSelectedInternetAccount(newlySelectedInternetAccount)
  }

  function handleChangeFile(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) {
      return
    }
    const selectedFile = e.target.files.item(0)
    setFile(selectedFile)
    if (
      selectedFile?.name.toLowerCase().endsWith('.fasta') ??
      selectedFile?.name.toLowerCase().endsWith('.fna') ??
      selectedFile?.name.toLowerCase().endsWith('.fa')
    ) {
      setFileType(FileType.FASTA)
    } else if (
      selectedFile?.name.toLowerCase().endsWith('.gff3') ??
      selectedFile?.name.toLowerCase().endsWith('.gff')
    ) {
      setFileType(FileType.GFF3)
    }
  }

  function handleChangeFileType(e: React.ChangeEvent<HTMLInputElement>) {
    setFileType(e.target.value as FileType)
    setImportFeatures(e.target.value === FileType.GFF3)
    setFastaFile('')
    setFastaIndexFile('')
    setFile(null)
  }

  function checkAssemblyName(assembly: string) {
    const { assemblies } = session as unknown as AbstractSessionModel
    const checkAsm = assemblies.find(
      (asm) => readConfObject(asm, 'displayName') === assembly,
    )
    if (checkAsm) {
      setValidAsm(false)
      setErrorMessage(`Assembly ${assembly} already exists.`)
    } else {
      setValidAsm(true)
      setErrorMessage('')
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    setSubmitted(true)
    setLoading(true)

    notify(`Assembly "${assemblyName}" is being added`, 'info')
    handleClose()
    event.preventDefault()

    const { jobsManager } = session
    const controller = new AbortController()

    const job = {
      name: `UploadAssemblyFile for ${assemblyName}`,
      statusMessage: 'Pre-validating',
      progressPct: 0,
      cancelCallback: () => {
        controller.abort()
        jobsManager.abortJob(job.name)
      },
    }

    jobsManager.runJob(job)

    let fileId = ''
    const { baseURL, getFetcher, internetAccountId } = selectedInternetAccount
    if (fileType !== FileType.EXTERNAL && file) {
      // First upload file
      const url = new URL('/files', baseURL).href
      const formData = new FormData()
      formData.append('file', file)
      formData.append('fileName', file.name)
      formData.append('type', fileType)
      const apolloFetchFile = getFetcher({
        locationType: 'UriLocation',
        uri: url,
      })
      if (apolloFetchFile) {
        jobsManager.update(job.name, 'Uploading file, this may take awhile')
        const { signal } = controller
        const response = await apolloFetchFile(url, {
          method: 'POST',
          body: formData,
          signal,
        })
        if (!response.ok) {
          const newErrorMessage = await createFetchErrorMessage(
            response,
            'Error when inserting new assembly (while uploading file)',
          )
          jobsManager.abortJob(job.name, newErrorMessage)
          setErrorMessage(newErrorMessage)
          return
        }
        const result = await response.json()
        fileId = result._id
      }
    }

    let change:
      | AddAssemblyFromExternalChange
      | AddAssemblyAndFeaturesFromFileChange
      | AddAssemblyFromFileChange
    if (fileType === FileType.EXTERNAL) {
      change = new AddAssemblyFromExternalChange({
        typeName: 'AddAssemblyFromExternalChange',

        assembly: new ObjectID().toHexString(),
        assemblyName,
        externalLocation: {
          fa: fastaFile,
          fai: fastaIndexFile,
          ...(fastaGziIndexFile ? { gzi: fastaGziIndexFile } : {}),
        },
      })
    } else {
      const fileUploadChangeBase = {
        assembly: new ObjectID().toHexString(),
        assemblyName,
        fileId,
      }
      change =
        fileType === FileType.GFF3 && importFeatures
          ? new AddAssemblyAndFeaturesFromFileChange({
              typeName: 'AddAssemblyAndFeaturesFromFileChange',
              ...fileUploadChangeBase,
            })
          : new AddAssemblyFromFileChange({
              typeName: 'AddAssemblyFromFileChange',
              ...fileUploadChangeBase,
            })
    }

    jobsManager.done(job)

    await changeManager.submit(change, {
      internetAccountId,
      updateJobsManager: true,
    })

    setSubmitted(false)
    setLoading(false)
  }

  let validFastaFile = false
  try {
    const url = new URL(fastaFile)
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      validFastaFile = true
    }
  } catch {
    // pass
  }
  let validFastaIndexFile = false
  try {
    const url = new URL(fastaIndexFile)
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      validFastaIndexFile = true
    }
  } catch {
    // pass
  }
  let validFastaGziIndexFile = false
  try {
    const url = new URL(fastaGziIndexFile)
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      validFastaGziIndexFile = true
    }
  } catch {
    // pass
  }

  return (
    <Dialog
      open
      maxWidth={false}
      data-testid="add-assembly-dialog"
      title="Add new assembly"
      handleClose={handleClose}
    >
      {loading ? <LinearProgress /> : null}
      <form onSubmit={onSubmit}>
        <DialogContent style={{ display: 'flex', flexDirection: 'column' }}>
          {apolloInternetAccounts.length > 1 ? (
            <>
              <DialogContentText>Select account</DialogContentText>
              <Select
                value={selectedInternetAccount.internetAccountId}
                onChange={handleChangeInternetAccount}
                disabled={submitted && !errorMessage}
              >
                {internetAccounts.map((option) => (
                  <MenuItem key={option.id} value={option.internetAccountId}>
                    {option.name}
                  </MenuItem>
                ))}
              </Select>
            </>
          ) : null}
          <TextField
            margin="dense"
            id="name"
            label="Assembly name"
            type="TextField"
            fullWidth
            variant="outlined"
            onChange={(e) => {
              setSubmitted(false)
              setAssemblyName(e.target.value)
              checkAssemblyName(e.target.value)
            }}
            disabled={submitted && !errorMessage}
          />
          <FormControl style={{ marginTop: 20 }}>
            <FormLabel>Select GFF3, FASTA or EXTERNAL option</FormLabel>
            <RadioGroup
              aria-labelledby="demo-radio-buttons-group-label"
              defaultValue={FileType.GFF3}
              name="radio-buttons-group"
              onChange={handleChangeFileType}
              value={fileType}
            >
              <FormControlLabel
                value={FileType.GFF3}
                control={<Radio />}
                label="GFF3"
                disabled={submitted && !errorMessage}
              />
              <FormControlLabel
                value={FileType.FASTA}
                control={<Radio />}
                label="FASTA"
                disabled={submitted && !errorMessage}
              />
              <FormControlLabel
                value={FileType.EXTERNAL}
                control={<Radio />}
                label="External"
                disabled={submitted && !errorMessage}
              />
            </RadioGroup>
          </FormControl>
          {fileType === FileType.EXTERNAL ? (
            <Box style={{ marginTop: 20 }}>
              <Typography variant="caption">
                Enter FASTA and FASTA index(es) URL
              </Typography>
              <TextField
                margin="dense"
                helperText="Can be bgz-compressed"
                id="fasta"
                label="FASTA"
                type="TextField"
                fullWidth
                variant="outlined"
                error={!validFastaFile}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setFastaFile(e.target.value)
                }}
                disabled={submitted && !errorMessage}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LinkIcon />
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                margin="dense"
                id="fasta-index"
                label="FASTA Index"
                helperText=".fai or .gz.fai"
                type="TextField"
                fullWidth
                variant="outlined"
                error={!validFastaIndexFile}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setFastaIndexFile(e.target.value)
                }}
                disabled={submitted && !errorMessage}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LinkIcon />
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                margin="dense"
                id="fasta-gzi-index"
                label="FASTA GZI Index"
                helperText="Only for bgz-compressed FASTA, .gz.gzi"
                type="TextField"
                fullWidth
                variant="outlined"
                error={Boolean(fastaGziIndexFile) && !validFastaGziIndexFile}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setFastaGziIndexFile(e.target.value)
                }}
                disabled={submitted && !errorMessage}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LinkIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
          ) : (
            <Box style={{ marginTop: 20 }}>
              <input
                type="file"
                onChange={handleChangeFile}
                disabled={submitted && !errorMessage}
              />
              <FormGroup>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={fileType === FileType.GFF3 && importFeatures}
                      onChange={() => {
                        setImportFeatures(!importFeatures)
                      }}
                      disabled={
                        fileType !== FileType.GFF3 ||
                        (submitted && !errorMessage)
                      }
                    />
                  }
                  label="Also load features from GFF3 file"
                />
              </FormGroup>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            disabled={
              !validAsm ||
              !(
                (assemblyName && file) ??
                (assemblyName &&
                  fastaFile &&
                  fastaIndexFile &&
                  validFastaFile &&
                  validFastaIndexFile)
              ) ||
              submitted
            }
            variant="contained"
            type="submit"
          >
            {submitted ? 'Submitting...' : 'Submit'}
          </Button>
          <Button variant="outlined" type="submit" onClick={handleClose}>
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
