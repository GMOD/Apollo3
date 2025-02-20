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
  FormControlLabel,
  FormGroup,
  Table,
  TableBody,
  TableCell,
  TableRow,
  TextField,
  Typography,
  InputAdornment,
  Tooltip,
  IconButton,
} from '@mui/material'

import InfoIcon from '@mui/icons-material/Info'

import LinearProgress from '@mui/material/LinearProgress'
import ObjectID from 'bson-objectid'
import { getRoot } from 'mobx-state-tree'
import React, { useEffect, useState } from 'react'

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
  BGZIP_FASTA = 'application/x-bgzip-fasta',
  FAI = 'text/x-fai',
  GZI = 'application/x-gzi',
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
  const [fileType, setFileType] = useState(FileType.BGZIP_FASTA)
  const [importFeatures, setImportFeatures] = useState(true)
  const [sequenceIsEditable, setSequenceIsEditable] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const [fastaFile, setFastaFile] = useState<File | null>(null)
  const [fastaIndexFile, setFastaIndexFile] = useState<File | null>(null)
  const [fastaGziIndexFile, setFastaGziIndexFile] = useState<File | null>(null)

  const [fastaUrl, setFastaUrl] = useState<string>('')
  const [fastaIndexUrl, setFastaIndexUrl] = useState<string>('')
  const [fastaGziIndexUrl, setFastaGziIndexUrl] = useState<string>('')

  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setFastaIndexUrl(fastaUrl ? `${fastaUrl}.fai` : '')
  }, [fastaUrl])

  useEffect(() => {
    setFastaGziIndexUrl(fastaUrl ? `${fastaUrl}.gzi` : '')
  }, [fastaUrl])

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

  async function uploadFile(file: File, fileType: FileType): Promise<string> {
    const { jobsManager } = session
    const controller = new AbortController()

    const [{ baseURL, getFetcher }] = apolloInternetAccounts
    const url = new URL('files', baseURL)

    url.searchParams.set('type', fileType)
    const uri = url.href
    const formData = new FormData()
    formData.append('file', file)
    formData.append('fileName', file.name)
    formData.append('type', fileType)
    const apolloFetchFile = getFetcher({
      locationType: 'UriLocation',
      uri,
    })
    if (apolloFetchFile) {
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
      jobsManager.update(
        job.name,
        `Uploading ${file.name}, this may take awhile`,
      )
      const { signal } = controller

      const headers = new Headers()
      if (file.name.endsWith('.gz')) {
        headers.append('Content-Encoding', 'gzip')
      }

      const response = await apolloFetchFile(uri, {
        method: 'POST',
        body: formData,
        signal,
        headers,
      })
      if (!response.ok) {
        const newErrorMessage = await createFetchErrorMessage(
          response,
          'Error when inserting new assembly (while uploading file)',
        )
        jobsManager.abortJob(job.name, newErrorMessage)
        setErrorMessage(newErrorMessage)
        return ''
      }
      const result = await response.json()
      const fileId = result._id as string
      jobsManager.done(job)
      return fileId
    }
    throw new Error('Failed to fetch')
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    setSubmitted(true)
    setLoading(true)

    notify(`Assembly "${assemblyName}" is being added`, 'info')
    handleClose()
    event.preventDefault()

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
          fa: fastaUrl,
          fai: fastaIndexUrl,
          gzi: fastaGziIndexUrl,
        },
      })
    } else {
      if (!fastaFile) {
        throw new Error('Missing fasta file')
      }
      if (fileType === FileType.GFF3 && importFeatures) {
        const faId = await uploadFile(fastaFile, FileType.GFF3)
        change = new AddAssemblyAndFeaturesFromFileChange({
          typeName: 'AddAssemblyAndFeaturesFromFileChange',
          assembly: new ObjectID().toHexString(),
          assemblyName,
          fileIds: { fa: faId },
        })
      } else if (fileType === FileType.GFF3) {
        const faId = await uploadFile(fastaFile, FileType.GFF3)
        change = new AddAssemblyFromFileChange({
          typeName: 'AddAssemblyFromFileChange',
          assembly: new ObjectID().toHexString(),
          assemblyName,
          fileIds: {
            fa: faId,
          },
        })
      } else if (sequenceIsEditable) {
        const faId = await uploadFile(fastaFile, FileType.FASTA)
        change = new AddAssemblyFromFileChange({
          typeName: 'AddAssemblyFromFileChange',
          assembly: new ObjectID().toHexString(),
          assemblyName,
          fileIds: {
            fa: faId,
          },
        })
      } else {
        if (!fastaIndexFile || !fastaGziIndexFile) {
          throw new Error('Missing fasta index files')
        }
        const faId = await uploadFile(fastaFile, FileType.BGZIP_FASTA)
        const faiId = await uploadFile(fastaIndexFile, FileType.FAI)
        const gziId = await uploadFile(fastaGziIndexFile, FileType.GZI)

        change = new AddAssemblyFromFileChange({
          typeName: 'AddAssemblyFromFileChange',
          assembly: new ObjectID().toHexString(),
          assemblyName,
          fileIds: {
            fa: faId,
            fai: faiId,
            gzi: gziId,
          },
        })
      }
    }

    const [{ internetAccountId }] = apolloInternetAccounts
    await changeManager.submit(change, {
      internetAccountId,
      updateJobsManager: true,
    })
    setSubmitted(false)
    setLoading(false)
  }

  let validFastaUrl = false
  try {
    const url = new URL(fastaUrl)
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      validFastaUrl = true
    }
  } catch {
    // pass
  }
  let validFastaIndexUrl = false
  try {
    const url = new URL(fastaIndexUrl)
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      validFastaIndexUrl = true
    }
  } catch {
    // pass
  }
  let validFastaGziIndexUrl = false
  try {
    const url = new URL(fastaGziIndexUrl)
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      validFastaGziIndexUrl = true
    }
  } catch {
    // pass
  }

  return (
    <Dialog
      open={true}
      handleClose={handleClose}
      data-testid="add-assembly-dialog"
      title="Add new assembly"
      maxWidth={false}
    >
      <form onSubmit={onSubmit}>
        <DialogContent>
          {loading ? <LinearProgress /> : null}
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

          <Typography
            variant="h6"
            style={{ marginTop: '10px', display: 'block' }}
          >
            <input
              type="radio"
              name="fastaInputOption"
              checked={
                fileType === FileType.BGZIP_FASTA ||
                fileType === FileType.EXTERNAL
              }
              onChange={() => {
                setFileType(FileType.BGZIP_FASTA)
              }}
            />
            FASTA input
          </Typography>
          {fileType === FileType.BGZIP_FASTA ||
          fileType === FileType.EXTERNAL ? (
            <FormGroup>
              <FormControlLabel
                control={
                  <Checkbox
                    onChange={() => {
                      setFileType(
                        fileType === FileType.EXTERNAL
                          ? FileType.BGZIP_FASTA
                          : FileType.EXTERNAL,
                      )
                    }}
                    disabled={sequenceIsEditable}
                  />
                }
                label="Files are on remote URL"
              />

              <FormControlLabel
                control={
                  <Checkbox
                    onChange={() => {
                      setSequenceIsEditable(!sequenceIsEditable)
                    }}
                  />
                }
                label={
                  <Box display="flex" alignItems="center">
                    <span>Allow sequence to be editable</span>
                    <Tooltip
                      title="Use with care: If checked, users can edit the genomic sequence together with the annotation"
                      placement="top-start"
                    >
                      <IconButton size="small">
                        <InfoIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                }
                disabled={fileType === FileType.EXTERNAL}
              />

              {fileType === FileType.BGZIP_FASTA ? (
                <Table size="small" sx={{ mt: 2 }}>
                  <TableBody>
                    <TableRow />
                    <TableCell style={{ borderBottomWidth: 0 }}>
                      <Box display="flex" alignItems="center">
                        <span>FASTA</span>
                        <Tooltip title="Unless the editable option is enabled, FASTA input must be compressed with bgzip and indexed with samtools faidx (or equivalent). Compression and indexing are optional for editable input.">
                          <IconButton size="small">
                            <InfoIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                    <TableCell style={{ borderBottomWidth: 0 }}>
                      <input
                        type="file"
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          setFastaFile(e.target.files?.item(0) ?? null)
                        }}
                        disabled={submitted && !errorMessage}
                      />
                    </TableCell>

                    <TableRow />
                    <TableCell style={{ borderBottomWidth: 0 }}>
                      FASTA index (.fai)
                    </TableCell>
                    <TableCell style={{ borderBottomWidth: 0 }}>
                      <input
                        type="file"
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          setFastaIndexFile(e.target.files?.item(0) ?? null)
                        }}
                        disabled={
                          (submitted && !errorMessage) || sequenceIsEditable
                        }
                      />
                    </TableCell>

                    <TableRow />
                    <TableCell style={{ borderBottomWidth: 0 }}>
                      FASTA binary index (.gzi)
                    </TableCell>
                    <TableCell style={{ borderBottomWidth: 0 }}>
                      <input
                        type="file"
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          setFastaGziIndexFile(e.target.files?.item(0) ?? null)
                        }}
                        disabled={
                          (submitted && !errorMessage) || sequenceIsEditable
                        }
                      />
                    </TableCell>
                  </TableBody>
                </Table>
              ) : (
                <Table size="small" sx={{ mt: 2 }}>
                  <TableBody>
                    <TableRow />
                    <TableCell style={{ borderBottomWidth: 0 }}>
                      <Box display="flex" alignItems="center">
                        <span>FASTA</span>
                        <Tooltip title="Remote FASTA input must be compressed with bgzip and indexed with samtools faidx (or equivalent)">
                          <IconButton size="small">
                            <InfoIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                    <TableCell style={{ borderBottomWidth: 0 }}>
                      <TextField
                        variant="outlined"
                        value={fastaUrl}
                        error={!validFastaUrl}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          setFastaUrl(e.target.value)
                        }}
                        disabled={submitted && !errorMessage}
                        slotProps={{
                          input: {
                            startAdornment: (
                              <InputAdornment position="start">
                                <LinkIcon />
                              </InputAdornment>
                            ),
                          },
                        }}
                      />
                    </TableCell>

                    <TableRow />
                    <TableCell style={{ borderBottomWidth: 0 }}>
                      FASTA index (.fai)
                    </TableCell>
                    <TableCell style={{ borderBottomWidth: 0 }}>
                      <TextField
                        variant="outlined"
                        value={fastaIndexUrl}
                        error={!validFastaIndexUrl}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          setFastaIndexUrl(e.target.value)
                        }}
                        disabled={submitted && !errorMessage}
                        slotProps={{
                          input: {
                            startAdornment: (
                              <InputAdornment position="start">
                                <LinkIcon />
                              </InputAdornment>
                            ),
                          },
                        }}
                      />
                    </TableCell>

                    <TableRow />
                    <TableCell style={{ borderBottomWidth: 0 }}>
                      FASTA binary index (.gzi)
                    </TableCell>
                    <TableCell style={{ borderBottomWidth: 0 }}>
                      <TextField
                        variant="outlined"
                        value={fastaGziIndexUrl}
                        error={!validFastaGziIndexUrl}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          setFastaGziIndexUrl(e.target.value)
                        }}
                        disabled={submitted && !errorMessage}
                        slotProps={{
                          input: {
                            startAdornment: (
                              <InputAdornment position="start">
                                <LinkIcon />
                              </InputAdornment>
                            ),
                          },
                        }}
                      />
                    </TableCell>
                  </TableBody>
                </Table>
              )}
            </FormGroup>
          ) : (
            <div></div>
          )}
          <Box display="flex" alignItems="center">
            <Typography
              variant="h6"
              style={{ marginTop: '10px', display: 'block' }}
            >
              <input
                type="radio"
                name="gffInputOption"
                checked={fileType === FileType.GFF3}
                onChange={() => {
                  setFileType(FileType.GFF3)
                }}
              />
              <span>GFF3 input</span>
              <Tooltip title="Alternatively, upload assembly from a GFF3 file which includes FASTA sequences. File can be gzip compressed.">
                <IconButton size="small">
                  <InfoIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            </Typography>
          </Box>

          {fileType === FileType.GFF3 ? (
            <Box style={{ marginTop: 20 }}>
              <input
                type="file"
                disabled={submitted && !errorMessage}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setFastaFile(e.target.files?.item(0) ?? null)
                  setSequenceIsEditable(true)
                }}
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
          ) : (
            <div></div>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            disabled={!validAsm || submitted}
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
