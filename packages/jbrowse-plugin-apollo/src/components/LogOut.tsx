import {
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
  MenuItem,
  Select,
  type SelectChangeEvent,
} from '@mui/material'
import { isAlive } from '@jbrowse/mobx-state-tree'
import React, { useState } from 'react'

import type { ApolloInternetAccountModel } from '../ApolloInternetAccount/model'
import { type ApolloRootModel, isApolloInternetAccount } from '../types'

import { Dialog } from './Dialog'

interface DeleteAssemblyProps {
  rootModel: ApolloRootModel
  handleClose(): void
}

export function LogOut({ handleClose, rootModel }: DeleteAssemblyProps) {
  const { internetAccounts } = rootModel
  const [errorMessage, setErrorMessage] = useState('')
  const apolloInternetAccounts = internetAccounts.filter((account) => {
    try {
      if (!isAlive(account)) {
        return false
      }
      return isApolloInternetAccount(account)
    } catch {
      return false
    }
  }) as ApolloInternetAccountModel[]

  if (apolloInternetAccounts.length === 0) {
    return null
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
    try {
      selectedInternetAccount.removeToken()
      globalThis.location.reload()
    } catch {
      setErrorMessage('Could not log out from this account. Please retry.')
    }
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
                {apolloInternetAccounts.map((option) => (
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
          <Button variant="outlined" type="button" onClick={handleClose}>
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
