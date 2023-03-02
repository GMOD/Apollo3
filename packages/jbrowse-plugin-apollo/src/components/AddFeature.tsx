import { AbstractSessionModel } from '@jbrowse/core/util'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  TextField,
} from '@mui/material'
import { AnnotationFeatureI } from 'apollo-mst'
import { AddFeatureChange } from 'apollo-shared'
import ObjectID from 'bson-objectid'
import React, { useEffect, useState } from 'react'

import { ApolloInternetAccountModel } from '../ApolloInternetAccount/model'
import { ChangeManager } from '../ChangeManager'
import { createFetchErrorMessage } from '../util'

interface AddFeatureProps {
  session: AbstractSessionModel
  handleClose(): void
  sourceFeature: AnnotationFeatureI
  sourceAssemblyId: string
  changeManager: ChangeManager
  internetAccount: ApolloInternetAccountModel
}

export function AddFeature({
  session,
  handleClose,
  sourceFeature,
  sourceAssemblyId,
  changeManager,
  internetAccount,
}: AddFeatureProps) {
  const { notify } = session
  const [end, setEnd] = useState(String(sourceFeature.end))
  const [start, setStart] = useState(String(sourceFeature.start))
  const [type, setType] = useState('')

  const [possibleChildTypes, setPossibleChildTypes] = useState<string[]>()

  const { baseURL } = internetAccount
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    async function getTypes() {
      const parentType = sourceFeature.type
      const url = `/ontologies/descendants/${parentType}`
      const uri = new URL(url, baseURL).href
      const apolloFetch = internetAccount?.getFetcher({
        locationType: 'UriLocation',
        uri,
      })
      const response = await apolloFetch(uri, {
        method: 'GET',
      })
      if (!response.ok) {
        const newErrorMessage = await createFetchErrorMessage(
          response,
          'Error when retrieving ontologies from server',
        )
        setErrorMessage(newErrorMessage)
        return
      }
      const data = (await response.json()) as string[]
      if (data.length < 1) {
        setErrorMessage(
          `Feature type "${parentType}" cannot have a child feature`,
        )
      }
      setPossibleChildTypes(data)
    }
    getTypes()
  }, [baseURL, internetAccount, sourceFeature.type])

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    const change = new AddFeatureChange({
      changedIds: [sourceFeature._id],
      typeName: 'AddFeatureChange',
      assembly: sourceAssemblyId,
      addedFeature: {
        _id: new ObjectID().toHexString(),
        refSeq: sourceFeature.refSeq,
        start: Number(start),
        end: Number(end),
        type,
      },
      parentFeatureId: sourceFeature._id,
    })
    changeManager.submit?.(change)
    notify(`Feature added successfully`, 'success')
    handleClose()
    event.preventDefault()
  }
  async function handleChangeType(e: SelectChangeEvent<string>) {
    setType(e.target.value)
  }
  const error = Number(end) <= Number(start)
  return (
    <Dialog open maxWidth="xl" data-testid="login-apollo">
      <DialogTitle>Add new feature</DialogTitle>
      <form onSubmit={onSubmit}>
        <DialogContent style={{ display: 'flex', flexDirection: 'column' }}>
          <TextField
            autoFocus
            margin="dense"
            id="start"
            label="Start"
            type="number"
            fullWidth
            variant="outlined"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
          <TextField
            margin="dense"
            id="end"
            label="End"
            type="number"
            fullWidth
            variant="outlined"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            error={error}
            helperText={error ? '"End" must be greater than "Start"' : null}
          />
          <FormControl>
            <InputLabel>Type</InputLabel>
            <Select value={type} onChange={handleChangeType} label="Type">
              {(possibleChildTypes || []).map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>

        <DialogActions>
          <Button
            variant="contained"
            type="submit"
            disabled={error || !(start && end && type)}
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
