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

enum PhaseEnum {
  zero = 0,
  one = 1,
  two = 2,
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
  const [phase, setPhase] = useState('')
  const [phaseAsNumber, setPhaseAsNumber] = useState<PhaseEnum>()
  const [showPhase, setShowPhase] = useState<boolean>(false)
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
    getTypes().catch((e) => setErrorMessage(String(e)))
  }, [baseURL, internetAccount, sourceFeature.type])

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    if (showPhase && phase === '') {
      setErrorMessage('The phase is REQUIRED for all CDS features.')
      return
    }
    const change = new AddFeatureChange({
      changedIds: [sourceFeature._id],
      typeName: 'AddFeatureChange',
      assembly: sourceAssemblyId,
      addedFeature: {
        _id: new ObjectID().toHexString(),
        gffId: '',
        refSeq: sourceFeature.refSeq,
        start: Number(start),
        end: Number(end),
        type,
        phase: phaseAsNumber,
      },
      parentFeatureId: sourceFeature._id,
    })
    await changeManager.submit?.(change)
    notify(`Feature added successfully`, 'success')
    handleClose()
    event.preventDefault()
  }
  async function handleChangeType(e: SelectChangeEvent<string>) {
    setErrorMessage('')
    setType(e.target.value)
    if (e.target.value.startsWith('CDS')) {
      setShowPhase(true)
      setPhase('')
    } else {
      setShowPhase(false)
    }
  }
  async function handleChangePhase(e: SelectChangeEvent<string>) {
    setErrorMessage('')
    setPhase(e.target.value)

    switch (Number(e.target.value)) {
      case 0:
        setPhaseAsNumber(PhaseEnum.zero)
        break
      case 1:
        setPhaseAsNumber(PhaseEnum.one)
        break
      case 2:
        setPhaseAsNumber(PhaseEnum.two)
        break
      default:
        setPhaseAsNumber(undefined)
    }
  }
  const error = Number(end) <= Number(start)
  return (
    <Dialog open maxWidth="xl" data-testid="login-apollo">
      <DialogTitle>Add new feature</DialogTitle>
      <form onSubmit={onSubmit}>
        <DialogContent style={{ display: 'flex', flexDirection: 'column' }}>
          <TextField
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
              {(possibleChildTypes ?? []).map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {showPhase ? (
            <FormControl>
              <InputLabel>Phase</InputLabel>
              <Select value={phase} onChange={handleChangePhase}>
                <MenuItem value={0}>0</MenuItem>
                <MenuItem value={1}>1</MenuItem>
                <MenuItem value={2}>2</MenuItem>
              </Select>
            </FormControl>
          ) : null}
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
