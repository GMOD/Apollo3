import { AbstractSessionModel, AppRootModel } from '@jbrowse/core/util'
import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  FormGroup,
  MenuItem,
  Select,
  SelectChangeEvent,
} from '@mui/material'
import { ChangeManager, DeleteAssemblyChange } from 'apollo-shared'
import { getRoot } from 'mobx-state-tree'
import React, { useState } from 'react'

import { ApolloInternetAccountModel } from '../ApolloInternetAccount/model'
import { AssemblyData, useAssemblies } from './'

interface DeleteAssemblyProps {
  session: AbstractSessionModel
  handleClose(): void
  changeManager: ChangeManager
}

export function DeleteAssembly({
  session,
  handleClose,
  changeManager,
}: DeleteAssemblyProps) {
  const { internetAccounts } = getRoot(session)
  const [selectedAssembly, setSelectedAssembly] = useState<AssemblyData>()
  const [errorMessage, setErrorMessage] = useState('')
  const [confirmDelete, setconfirmDelete] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const apolloInternetAccounts = internetAccounts.filter(
    (ia) => ia.type === 'ApolloInternetAccount',
  ) as ApolloInternetAccountModel[]
  if (!apolloInternetAccounts.length) {
    throw new Error('No Apollo internet account found')
  }
  const [selectedInternetAcount, setSelectedInternetAcount] = useState(
    apolloInternetAccounts[0],
  )
  const assemblies = useAssemblies(internetAccounts, setErrorMessage)

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

  function handleChangeAssembly(e: SelectChangeEvent<string>) {
    const newAssembly = assemblies.find((asm) => asm._id === e.target.value)
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
      assembly: selectedAssembly._id,
    })
    changeManager.submit?.(change, {
      internetAccountId: selectedInternetAcount.internetAccountId,
    })
    handleClose()
    event.preventDefault()
  }

  return (
    <Dialog open maxWidth="xl" data-testid="login-apollo">
      <DialogTitle>Delete Assembly</DialogTitle>
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
          <DialogContentText>Select assembly</DialogContentText>
          <Select
            labelId="label"
            value={selectedAssembly?._id || ''}
            onChange={handleChangeAssembly}
            disabled={!assemblies.length}
          >
            {assemblies.map((option) => (
              <MenuItem key={option._id} value={option._id}>
                {option.name}
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
                  onChange={() => setconfirmDelete(!confirmDelete)}
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
