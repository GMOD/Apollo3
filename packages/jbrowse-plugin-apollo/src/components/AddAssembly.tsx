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
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  SelectChangeEvent,
  TextField,
} from '@mui/material'
import {
  AddAssemblyAndFeaturesFromFileChange,
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

export function AddAssembly({
  changeManager,
  handleClose,
  session,
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
  const [fileType, setFileType] = useState('text/x-gff3')
  const [importFeatures, setImportFeatures] = useState(true)
  const [submitted, setSubmitted] = useState(false)
  const [selectedInternetAcount, setSelectedInternetAcount] = useState(
    apolloInternetAccounts[0],
  )

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
    setSubmitted(false)
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
      setFileType('text/x-fasta')
    } else if (
      selectedFile?.name.toLowerCase().endsWith('.gff3') ??
      selectedFile?.name.toLowerCase().endsWith('.gff')
    ) {
      setFileType('text/x-gff3')
    }
  }

  function handleChangeFileType(e: React.ChangeEvent<HTMLInputElement>) {
    setSubmitted(false)
    setFileType(e.target.value)
    if (e.target.value !== 'text/x-gff3') {
      setImportFeatures(false)
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    setSubmitted(true)
    // let fileChecksum = ''
    let fileId = ''
    if (!file) {
      throw new Error('must select a file')
    }

    // First upload file
    const { baseURL, getFetcher } = selectedInternetAcount
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

    const changeBase = {
      assembly: new ObjectID().toHexString(),
      assemblyName,
      fileId,
    }
    const change =
      fileType === 'text/x-gff3' && importFeatures
        ? new AddAssemblyAndFeaturesFromFileChange({
            typeName: 'AddAssemblyAndFeaturesFromFileChange',
            ...changeBase,
          })
        : new AddAssemblyFromFileChange({
            typeName: 'AddAssemblyFromFileChange',
            ...changeBase,
          })

    await changeManager.submit(change, {
      internetAccountId: selectedInternetAcount.internetAccountId,
    })
    notify(`Assembly "${assemblyName}" is being added`, 'info')
    handleClose()
    event.preventDefault()
  }

  return (
    <Dialog open maxWidth="xl" data-testid="add-assembly-dialog">
      <DialogTitle>Add new assembly</DialogTitle>
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
          <FormControl>
            <FormLabel>Select GFF3 or FASTA file</FormLabel>
            <RadioGroup
              aria-labelledby="demo-radio-buttons-group-label"
              defaultValue="text/x-gff3"
              name="radio-buttons-group"
              onChange={handleChangeFileType}
              value={fileType}
            >
              <FormControlLabel
                value="text/x-gff3"
                control={<Radio />}
                label="GFF3"
                disabled={submitted && !errorMessage}
              />
              <FormControlLabel
                value="text/x-fasta"
                control={<Radio />}
                label="FASTA"
                disabled={submitted && !errorMessage}
              />
            </RadioGroup>
          </FormControl>
          <input type="file" onChange={handleChangeFile} />
          <FormGroup>
            <FormControlLabel
              control={
                <Checkbox
                  checked={fileType === 'text/x-gff3' && importFeatures}
                  onChange={() => setImportFeatures(!importFeatures)}
                  disabled={
                    fileType !== 'text/x-gff3' || (submitted && !errorMessage)
                  }
                />
              }
              label="Also load features from GFF3 file"
            />
          </FormGroup>
        </DialogContent>
        <DialogActions>
          <Button
            disabled={!(assemblyName && file) || submitted}
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
