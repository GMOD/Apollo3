/* eslint-disable @typescript-eslint/no-misused-promises */
import { DeleteAssemblyChange } from '@apollo-annotation/apollo-shared'
import { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import {
  Button,
  Checkbox,
  DialogActions,
  DialogContent,
  DialogContentText,
  FormControlLabel,
  FormGroup,
  MenuItem,
  Select,
  SelectChangeEvent,
} from '@mui/material'
import { getRoot } from 'mobx-state-tree'
import React, { useEffect, useState } from 'react'

import { ApolloInternetAccountModel } from '../ApolloInternetAccount/model'
import {
  ApolloInternetAccount,
  CollaborationServerDriver,
} from '../BackendDrivers'
import { ChangeManager } from '../ChangeManager'
import { ApolloSessionModel } from '../session'
import { ApolloRootModel } from '../types'
import { Dialog } from './Dialog'

interface DeleteAssemblyProps {
  session: ApolloSessionModel
  handleClose(): void
  changeManager: ChangeManager
}

export function DeleteAssembly({
  changeManager,
  handleClose,
  session,
}: DeleteAssemblyProps) {
  const { internetAccounts } = getRoot<ApolloRootModel>(session)
  const [selectedAssembly, setSelectedAssembly] = useState<Assembly>()
  const [errorMessage, setErrorMessage] = useState('')
  const [confirmDelete, setconfirmDelete] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const apolloInternetAccounts = internetAccounts.filter(
    (ia) => ia.type === 'ApolloInternetAccount',
  ) as ApolloInternetAccountModel[]
  if (apolloInternetAccounts.length === 0) {
    throw new Error('No Apollo internet account found')
  }
  const [selectedInternetAccount, setSelectedInternetAccount] = useState(
    apolloInternetAccounts[0],
  )

  const { collaborationServerDriver } = session.apolloDataStore as {
    collaborationServerDriver: CollaborationServerDriver
    getInternetAccount(
      assemblyName?: string,
      internetAccountId?: string,
    ): ApolloInternetAccount
  }

  const assemblies = collaborationServerDriver.getAssemblies()

  useEffect(() => {
    if (assemblies.length > 0 && selectedAssembly === undefined) {
      setSelectedAssembly(assemblies[0])
    }
  }, [assemblies, selectedAssembly])

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

  function handleChangeAssembly(e: SelectChangeEvent) {
    const newAssembly = assemblies.find((asm) => asm.name === e.target.value)
    setSelectedAssembly(newAssembly)
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitted(true)
    setErrorMessage('')
    if (!selectedAssembly) {
      setErrorMessage('Must select assembly!')
      return
    }
    const change = new DeleteAssemblyChange({
      typeName: 'DeleteAssemblyChange',
      assembly: selectedAssembly.name,
    })
    await changeManager.submit(change, {
      internetAccountId: selectedInternetAccount.internetAccountId,
    })
    handleClose()
    event.preventDefault()
  }

  return (
    <Dialog
      open
      title="Delete Assembly"
      handleClose={handleClose}
      maxWidth={false}
      data-testid="delete-assembly"
    >
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
          <DialogContentText>Select assembly</DialogContentText>
          <Select
            labelId="label"
            value={selectedAssembly?.name ?? ''}
            onChange={handleChangeAssembly}
            disabled={assemblies.length === 0}
          >
            {assemblies.map((option) => (
              <MenuItem key={option.name} value={option.name}>
                {option.displayName ?? option.name}
              </MenuItem>
            ))}
          </Select>
          <DialogContentText>
            <strong style={{ color: 'red' }}>
              NOTE: All assembly data will be deleted and this operation cannot
              be undone!
            </strong>
          </DialogContentText>
          <FormGroup>
            <FormControlLabel
              control={
                <Checkbox
                  checked={confirmDelete}
                  onChange={() => {
                    setconfirmDelete(!confirmDelete)
                  }}
                />
              }
              label="I understand that all assembly data will be deleted"
            />
          </FormGroup>
        </DialogContent>

        <DialogActions>
          <Button
            disabled={!selectedAssembly || !confirmDelete}
            variant="contained"
            type="submit"
          >
            Delete
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
