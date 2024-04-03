import { AbstractSessionModel } from '@jbrowse/core/util'
import {
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
  MenuItem,
  Select,
  SelectChangeEvent,
} from '@mui/material'
import LinearProgress from '@mui/material/LinearProgress'
import { SaveTrackChange } from 'apollo-shared'
import { getRoot } from 'mobx-state-tree'
import React, { useState } from 'react'

import { ApolloInternetAccountModel } from '../ApolloInternetAccount/model'
import { ChangeManager } from '../ChangeManager'
import { ApolloSessionModel } from '../session'
import { ApolloRootModel } from '../types'
import { Dialog } from './Dialog'

interface SaveTrackProps {
  session: ApolloSessionModel
  handleClose(): void
  changeManager: ChangeManager
}

export function SaveTrack({
  changeManager,
  handleClose,
  session,
}: SaveTrackProps) {
  const { internetAccounts } = getRoot<ApolloRootModel>(session)
  const { notify } = session as unknown as AbstractSessionModel
  const apolloInternetAccounts = internetAccounts.filter(
    (ia) => ia.type === 'ApolloInternetAccount',
  ) as ApolloInternetAccountModel[]
  if (apolloInternetAccounts.length === 0) {
    throw new Error('No Apollo internet account found')
  }
  const [trackConfig, setTrackConfig] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [selectedInternetAccount, setSelectedInternetAccount] = useState(
    apolloInternetAccounts[0],
  )
  const [loading, setLoading] = useState(false)

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
    setSelectedInternetAccount(newlySelectedInternetAccount)
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    setSubmitted(true)
    setLoading(true)

    notify('Saving track...', 'info')
    handleClose()
    event.preventDefault()

    const { internetAccountId } = selectedInternetAccount
    const jsonObject = JSON.parse(trackConfig)
    const { type } = jsonObject
    const { trackId } = jsonObject
    if (!type) {
      setErrorMessage('"Type" is missing in the track configuration')
      return
    }
    if (!trackId) {
      setErrorMessage('"TrackId" is missing in the track configuration')
      return
    }
    console.log(`Type:${type}`)
    console.log(`TrackId:${trackId}`)
    const change = new SaveTrackChange({
      typeName: 'SaveTrackChange',
      trackConfig,
      changes: [],
    })
    await changeManager.submit(change, {
      internetAccountId,
    })

    setSubmitted(false)
    setLoading(false)
    notify('Track saved', 'success')
  }

  return (
    <Dialog
      open
      maxWidth={false}
      data-testid="add-assembly-dialog"
      title="Save Track Configuration"
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
          <textarea
            style={{ width: '600px', height: '450px' }}
            placeholder="Paste track information here..."
            onChange={(e) => {
              setSubmitted(false)
              setTrackConfig(e.target.value)
            }}
            disabled={submitted && !errorMessage}
          />
        </DialogContent>
        <DialogActions>
          <Button
            disabled={!(trackConfig || submitted)}
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
