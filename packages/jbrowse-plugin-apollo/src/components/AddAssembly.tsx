import { AbstractSessionModel, AppRootModel } from '@jbrowse/core/util'
import LinkIcon from '@mui/icons-material/Link'
import {
  Box,
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
import {
  AddAssemblyAndFeaturesFromFileChange,
  AddAssemblyFromExternalChange,
  AddAssemblyFromFileChange,
} from 'apollo-shared'
import ObjectID from 'bson-objectid'
import { getRoot } from 'mobx-state-tree'
import React, { useState } from 'react'

import { ApolloInternetAccountModel } from '../ApolloInternetAccount/model'
import { ChangeManager } from '../ChangeManager'
import { createFetchErrorMessage } from '../util'

interface AddAssemblyProps {
  session: AbstractSessionModel
  handleClose(): void
  changeManager: ChangeManager
}

interface FileUploadChangeBase {
  assembly: string
  assemblyName: string
  fileId: string
}

interface ExternalAssemblyChangeBase {
  assembly: string
  assemblyName: string
  externalLocation: {
    fa: string
    fai: string
  }
}

enum FileType {
  GFF3 = 'text/x-gff3',
  FASTA = 'text/x-fasta',
  EXTERNAL = 'text/x-external',
}

export function AddAssembly({
  session,
  handleClose,
  changeManager,
}: AddAssemblyProps) {
  const { internetAccounts } = getRoot(session) as AppRootModel
  const { notify } = session
  const apolloInternetAccounts = internetAccounts.filter(
    (ia) => ia.type === 'ApolloInternetAccount',
  ) as ApolloInternetAccountModel[]
  if (!apolloInternetAccounts.length) {
    throw new Error('No Apollo internet account found')
  }
  const [assemblyName, setAssemblyName] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [fileType, setFileType] = useState(FileType.GFF3)
  const [importFeatures, setImportFeatures] = useState(true)
  const [submitted, setSubmitted] = useState(false)
  const [selectedInternetAcount, setSelectedInternetAcount] = useState(
    apolloInternetAccounts[0],
  )
  const [fastaFile, setFastaFile] = useState('')
  const [validFastaFile, setValidFastaFile] = useState(true)
  const [fastaIndexFile, setFastaIndexFile] = useState('')
  const [validFastaIndexFile, setValidFastaIndexFile] = useState(true)
  const [loading, setLoading] = useState(false)
  const r = /^(http|https):\/\/.+$/

  function handleChangeInternetAccount(e: SelectChangeEvent<string>) {
    setSubmitted(false)
    const newlySelectedInternetAccount = apolloInternetAccounts.find(
      (ia) => ia.internetAccountId === e.target.value,
    )
    if (!newlySelectedInternetAccount) {
      throw new Error(
        `Could not find internetAccount with ID "${e.target.value}"`,
      )
    }
    setSelectedInternetAcount(newlySelectedInternetAccount)
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

  function updateFastaFile(url: string) {
    setValidFastaFile(r.test(url))
    setFastaFile(url)
  }

  function updateFastaIndexFile(url: string) {
    setValidFastaIndexFile(r.test(url))
    setFastaIndexFile(url)
  }

  function handleChangeFileType(e: React.ChangeEvent<HTMLInputElement>) {
    setFileType(e.target.value as FileType)
    setImportFeatures(e.target.value === FileType.GFF3)
    setFastaFile('')
    setFastaIndexFile('')
    setFile(null)
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    setSubmitted(true)
    setLoading(true)

    // let fileChecksum = ''
    let fileId = ''
    const { baseURL, getFetcher } = selectedInternetAcount
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
        const response = await apolloFetchFile(url, {
          method: 'POST',
          body: formData,
        })
        if (!response.ok) {
          const newErrorMessage = await createFetchErrorMessage(
            response,
            'Error when inserting new assembly (while uploading file)',
          )
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
    if (fileType == FileType.EXTERNAL) {
      const externalAssemblyChangeBase: ExternalAssemblyChangeBase = {
        assembly: new ObjectID().toHexString(),
        assemblyName,
        externalLocation: {
          fa: fastaFile,
          fai: fastaIndexFile,
        },
      }
      change = new AddAssemblyFromExternalChange({
        typeName: 'AddAssemblyFromExternalChange',
        ...externalAssemblyChangeBase,
      })
    } else {
      const fileUploadChangeBase: FileUploadChangeBase = {
        assembly: new ObjectID().toHexString(),
        assemblyName,
        fileId,
      }
      if (fileType === FileType.GFF3 && importFeatures) {
        change = new AddAssemblyAndFeaturesFromFileChange({
          typeName: 'AddAssemblyAndFeaturesFromFileChange',
          ...fileUploadChangeBase,
        })
      } else {
        change = new AddAssemblyFromFileChange({
          typeName: 'AddAssemblyFromFileChange',
          ...fileUploadChangeBase,
        })
      }
    }

    await changeManager.submit(change, {
      internetAccountId: selectedInternetAcount.internetAccountId,
    })

    setSubmitted(false)
    setLoading(false)
    notify(`Assembly "${assemblyName}" is being added`, 'info')
    handleClose()
    event.preventDefault()
  }

  return (
    <Dialog open maxWidth="xs" data-testid="login-apollo" fullWidth={true}>
      <DialogTitle>Add new assembly</DialogTitle>
      {loading ? <LinearProgress /> : null}
      <form onSubmit={onSubmit}>
        <DialogContent style={{ display: 'flex', flexDirection: 'column' }}>
          {apolloInternetAccounts.length > 1 ? (
            <>
              <DialogContentText>Select account</DialogContentText>
              <Select
                value={selectedInternetAcount.internetAccountId}
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
                label="EXTERNAL"
                disabled={submitted && !errorMessage}
              />
            </RadioGroup>
          </FormControl>
          {fileType === FileType.EXTERNAL ? (
            <Box style={{ marginTop: 20 }}>
              <Typography variant="caption">
                Enter FASTA and FASTA index file URL
              </Typography>
              <TextField
                margin="dense"
                id="fasta"
                label="FASTA"
                type="TextField"
                fullWidth
                variant="outlined"
                error={!validFastaFile}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  updateFastaFile(e.target.value)
                }
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
                type="TextField"
                fullWidth
                variant="outlined"
                error={!validFastaIndexFile}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  updateFastaIndexFile(e.target.value)
                }
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
                      onChange={() => setImportFeatures(!importFeatures)}
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
              !(
                (assemblyName && file) ??
                (assemblyName &&
                  fastaFile &&
                  fastaIndexFile &&
                  validFastaFile &&
                  validFastaIndexFile)
              ) || submitted
            }
            variant="contained"
            type="submit"
          >
            {submitted ? 'Submitting...' : 'Submit'}
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
