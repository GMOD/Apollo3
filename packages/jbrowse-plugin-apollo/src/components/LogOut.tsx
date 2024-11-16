/* eslint-disable @typescript-eslint/unbound-method */
import {
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
  MenuItem,
  Select,
  SelectChangeEvent,
} from '@mui/material'
import { getRoot } from 'mobx-state-tree'
import React, { useState } from 'react'

import { ApolloInternetAccountModel } from '../ApolloInternetAccount/model'
import { ApolloSessionModel } from '../session'
import { ApolloRootModel } from '../types'
import { Dialog } from './Dialog'

interface DeleteAssemblyProps {
  session: ApolloSessionModel
  handleClose(): void
}

export function LogOut({ handleClose, session }: DeleteAssemblyProps) {
  const { internetAccounts } = getRoot<ApolloRootModel>(session)
  const [errorMessage, setErrorMessage] = useState('')
  const apolloInternetAccounts = internetAccounts.filter(
    (ia) => ia.type === 'ApolloInternetAccount',
  ) as ApolloInternetAccountModel[]
  if (apolloInternetAccounts.length === 0) {
    throw new Error('No Apollo internet account found')
  }
  const [selectedInternetAccount, setSelectedInternetAccount] = useState(
    apolloInternetAccounts[0],
  )

  function handleChangeInternetAccount(e: SelectChangeEvent) {
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

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    selectedInternetAccount.removeToken()
    window.location.reload()
  }

  return (
    <Dialog
      open
      title="Log out"
      handleClose={handleClose}
      maxWidth={false}
      data-testid="log-out"
    >
      <form onSubmit={onSubmit}>
        <DialogContent style={{ display: 'flex', flexDirection: 'column' }}>
          {apolloInternetAccounts.length > 1 ? (
            <>
              <DialogContentText>Select account</DialogContentText>
              <Select
                value={selectedInternetAccount.internetAccountId}
                onChange={handleChangeInternetAccount}
              >
                {internetAccounts.map((option) => (
                  <MenuItem key={option.id} value={option.internetAccountId}>
                    {option.name}
                  </MenuItem>
                ))}
              </Select>
            </>
          ) : null}
          <DialogContentText>
            Are you sure you want to log out?
          </DialogContentText>
        </DialogContent>

        <DialogActions>
          <Button
            disabled={!selectedInternetAccount}
            variant="contained"
            type="submit"
          >
            Log Out
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
