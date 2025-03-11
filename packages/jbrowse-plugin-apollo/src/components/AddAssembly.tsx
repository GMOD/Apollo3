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
import {
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  Box,
  FormGroup,
  FormControlLabel,
  Checkbox,
  LinearProgress,
  TextField,
  Tooltip,
  IconButton,
  Table,
  TableCell,
  TableBody,
  InputAdornment,
  TableRow,
} from '@mui/material'

import { makeStyles } from 'tss-react/mui'

import ObjectID from 'bson-objectid'
import { getRoot } from 'mobx-state-tree'
import React, { useEffect, useState } from 'react'

import { ApolloInternetAccountModel } from '../ApolloInternetAccount/model'
import { ChangeManager } from '../ChangeManager'
import { ApolloSessionModel } from '../session'
import { ApolloRootModel } from '../types'
import { createFetchErrorMessage } from '../util'
import { Dialog } from './Dialog'

import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import RadioButtonCheckedIcon from '@mui/icons-material/RadioButtonChecked'

import InfoIcon from '@mui/icons-material/Info'
import LinkIcon from '@mui/icons-material/Link'

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

const useStyles = makeStyles()((theme) => ({
  accordion: {
    border: `1px solid ${theme.palette.divider}`,
    '&:not(:last-child)': {
      borderBottom: 0,
    },
  },
  accordionSummary: {
    flexDirection: 'row-reverse',
  },
  accordionDetails: {
    padding: theme.spacing(2),
    borderTop: '1px solid rgba(0, 0, 0, .125)',
  },
  radioIcon: {
    color: theme?.palette?.tertiary?.contrastText,
  },
  dialog: {
    // minHeight: 500,
    minWidth: 550,
    maxWidth: 800,
  },
}))

function checkSumbission(
  validAsm: boolean,
  sequenceIsEditable: boolean,
  fileType: FileType,
  fastaFile: File | null,
  fastaIndexFile: File | null,
  fastaGziIndexFile: File | null,
  validFastaUrl: boolean,
  validFastaIndexUrl: boolean,
  validFastaGziIndexUrl: boolean,
) {
  if (!validAsm) {
    return false
  }
  if (sequenceIsEditable && fastaFile) {
    return true
  }
  if (fileType === FileType.GFF3 && fastaFile) {
    return true
  }
  if (fastaFile && fastaIndexFile && fastaGziIndexFile) {
    return true
  }
  if (validFastaUrl && validFastaIndexUrl && validFastaGziIndexUrl) {
    return true
  }
  return false
}

export function AddAssembly({
  changeManager,
  handleClose,
  session,
}: AddAssemblyProps) {
  const { classes } = useStyles()
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
  const [isGzip, setIsGzip] = useState<boolean>(false)

  useEffect(() => {
    setFastaIndexUrl(fastaUrl ? `${fastaUrl}.fai` : '')
  }, [fastaUrl])

  useEffect(() => {
    setFastaGziIndexUrl(fastaUrl ? `${fastaUrl}.gzi` : '')
  }, [fastaUrl])

  useEffect(() => {
    if (sequenceIsEditable || fileType === FileType.GFF3) {
      setIsGzip(
        fastaFile?.name.toLocaleLowerCase().endsWith('.gz') ? true : false,
      )
    } else {
      setIsGzip(true)
    }
  }, [fastaFile, sequenceIsEditable, fileType])

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
    let filename = file.name

    if (fileType === FileType.FAI || fileType === FileType.GZI) {
      filename = `${filename}.txt`
    } else if (isGzip && !file.name.toLocaleLowerCase().endsWith('.gz')) {
      filename = `${filename}.gz`
    } else if (!isGzip && file.name.toLocaleLowerCase().endsWith('.gz')) {
      filename = `${filename}.txt`
    }
    formData.append('file', file, filename)
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

      const response = await apolloFetchFile(uri, {
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

  const [expanded, setExpanded] = React.useState<string>('panelFastaInput')

  const handleAccordionChange =
    (panel: string) => (event: React.SyntheticEvent, newExpanded: boolean) => {
      if (newExpanded) {
        setExpanded(panel)
      }
      if (panel === 'panelGffInput') {
        setIsGzip(false)
      } else {
        setIsGzip(true)
      }
    }

  return (
    <Dialog
      open={true}
      handleClose={handleClose}
      data-testid="add-assembly-dialog"
      title="Add new assembly"
      maxWidth={false}
    >
      <form onSubmit={onSubmit} data-testid="submit-form">
        <DialogContent className={classes.dialog}>
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

          <Accordion
            disableGutters
            elevation={0}
            square
            className={classes.accordion}
            expanded={expanded === 'panelFastaInput'}
            onChange={handleAccordionChange('panelFastaInput')}
          >
            <AccordionSummary
              className={classes.accordionSummary}
              expandIcon={
                expanded === 'panelFastaInput' ? (
                  <RadioButtonCheckedIcon
                    className={classes.radioIcon}
                    sx={{ fontSize: '1.2rem', ml: 5 }}
                  />
                ) : (
                  <RadioButtonUncheckedIcon
                    className={classes.radioIcon}
                    sx={{ fontSize: '1.2rem', mr: 5 }}
                  />
                )
              }
              aria-controls="panelFastaInputd-content"
              id="panelFastaInputd-header"
            >
              <Typography component="span">FASTA input</Typography>
            </AccordionSummary>
            <AccordionDetails className={classes.accordionDetails}>
              <FormGroup>
                <FormControlLabel
                  data-testid="files-on-url-checkbox"
                  control={
                    <Checkbox
                      onChange={() => {
                        setFileType(
                          fileType === FileType.EXTERNAL
                            ? FileType.BGZIP_FASTA
                            : FileType.EXTERNAL,
                        )
                        if (fileType === FileType.EXTERNAL) {
                          setSequenceIsEditable(false)
                        }
                      }}
                      checked={fileType === FileType.EXTERNAL}
                      disabled={
                        sequenceIsEditable && fileType !== FileType.GFF3
                      }
                    />
                  }
                  label={
                    <Box display="flex" alignItems="center">
                      Use external URLs
                      <Tooltip
                        title="Use external URLs to provide FASTA and index files. Does not copy the files to the Apollo collaboration server, so ensure the URLs are stable."
                        placement="top-start"
                      >
                        <IconButton size="small">
                          <InfoIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  }
                />

                <FormControlLabel
                  data-testid="sequence-is-editable-checkbox"
                  control={
                    <Checkbox
                      onChange={() => {
                        setSequenceIsEditable(!sequenceIsEditable)
                      }}
                    />
                  }
                  checked={sequenceIsEditable}
                  disabled={fileType === FileType.EXTERNAL}
                  label={
                    <Box display="flex" alignItems="center">
                      Store sequence in database
                      <Tooltip
                        title="Enables users to edit the genomic sequence, but comes with performance impacts. Use with care."
                        placement="top-start"
                      >
                        <IconButton size="small">
                          <InfoIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  }
                />
                <FormControlLabel
                  data-testid="fasta-is-gzip-checkbox"
                  control={
                    <Checkbox
                      checked={isGzip}
                      onChange={() => {
                        if (sequenceIsEditable) {
                          setIsGzip(!isGzip)
                        } else {
                          setIsGzip(true)
                        }
                      }}
                      disabled={!sequenceIsEditable}
                    />
                  }
                  label="FASTA is gzip compressed"
                />

                {fileType === FileType.BGZIP_FASTA ||
                fileType === FileType.GFF3 ? (
                  <Table size="small" sx={{ mt: 2 }}>
                    <TableBody>
                      <TableRow />
                      <TableCell style={{ borderBottomWidth: 0 }}>
                        <Box display="flex" alignItems="center">
                          <span>FASTA</span>
                          <Tooltip title='Unless "Store sequence in database" enabled, FASTA input must be compressed with bgzip and indexed with samtools faidx (or equivalent). Compression is optional for sequences stored in the database.'>
                            <IconButton size="small">
                              <InfoIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                      <TableCell style={{ borderBottomWidth: 0 }}>
                        <input
                          data-testid="fasta-input-file"
                          type="file"
                          onChange={(
                            e: React.ChangeEvent<HTMLInputElement>,
                          ) => {
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
                          data-testid="fai-input-file"
                          type="file"
                          onChange={(
                            e: React.ChangeEvent<HTMLInputElement>,
                          ) => {
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
                          data-testid="gzi-input-file"
                          type="file"
                          onChange={(
                            e: React.ChangeEvent<HTMLInputElement>,
                          ) => {
                            setFastaGziIndexFile(
                              e.target.files?.item(0) ?? null,
                            )
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
                          data-testid="fasta-input-url"
                          variant="outlined"
                          value={fastaUrl}
                          error={!validFastaUrl}
                          onChange={(
                            e: React.ChangeEvent<HTMLInputElement>,
                          ) => {
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
                          data-testid="fai-input-url"
                          variant="outlined"
                          value={fastaIndexUrl}
                          error={!validFastaIndexUrl}
                          onChange={(
                            e: React.ChangeEvent<HTMLInputElement>,
                          ) => {
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
                          data-testid="gzi-input-url"
                          variant="outlined"
                          value={fastaGziIndexUrl}
                          error={!validFastaGziIndexUrl}
                          onChange={(
                            e: React.ChangeEvent<HTMLInputElement>,
                          ) => {
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
            </AccordionDetails>
          </Accordion>
          <Accordion
            disableGutters
            elevation={0}
            square
            className={classes.accordion}
            expanded={expanded === 'panelGffInput'}
            onChange={handleAccordionChange('panelGffInput')}
          >
            <AccordionSummary
              className={classes.accordionSummary}
              expandIcon={
                expanded === 'panelGffInput' ? (
                  <RadioButtonCheckedIcon
                    className={classes.radioIcon}
                    sx={{ fontSize: '1.2rem', ml: 5 }}
                  />
                ) : (
                  <RadioButtonUncheckedIcon
                    className={classes.radioIcon}
                    sx={{ fontSize: '1.2rem', mr: 5 }}
                  />
                )
              }
              aria-controls="panelGffInputd-content"
            >
              <Typography component="span">
                GFF3 input
                <Tooltip title="GFF3 must includes FASTA sequences. File can be gzip compressed.">
                  <InfoIcon
                    className={classes.radioIcon}
                    sx={{ fontSize: 18 }}
                  />
                </Tooltip>
              </Typography>
            </AccordionSummary>
            <AccordionDetails className={classes.accordionDetails}>
              <Box style={{ marginTop: 20 }}>
                <input
                  data-testid="gff3-input-file"
                  type="file"
                  disabled={submitted && !errorMessage}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    setFastaFile(e.target.files?.item(0) ?? null)
                    setFileType(FileType.GFF3)
                  }}
                />
                <FormGroup style={{ display: 'grid' }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={importFeatures}
                        onChange={() => {
                          setImportFeatures(!importFeatures)
                        }}
                        disabled={submitted && !errorMessage}
                      />
                    }
                    label="Load features from GFF3 file"
                  />
                  <FormControlLabel
                    data-testid="gff3-is-gzip-checkbox"
                    control={
                      <Checkbox
                        checked={isGzip}
                        onChange={() => {
                          setIsGzip(!isGzip)
                        }}
                        disabled={submitted && !errorMessage}
                      />
                    }
                    label="GFF3 is gzip compressed"
                  />
                </FormGroup>
              </Box>
            </AccordionDetails>
          </Accordion>
        </DialogContent>
        <DialogActions>
          <Button
            disabled={
              !checkSumbission(
                validAsm,
                sequenceIsEditable,
                fileType,
                fastaFile,
                fastaIndexFile,
                fastaGziIndexFile,
                validFastaUrl,
                validFastaIndexUrl,
                validFastaGziIndexUrl,
              ) || submitted
            }
            variant="contained"
            type="submit"
            data-testid="submit-button"
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
