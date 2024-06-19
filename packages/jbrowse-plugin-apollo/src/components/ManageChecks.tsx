/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-misused-promises */
import { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import { AbstractSessionModel } from '@jbrowse/core/util'
import {
  Button,
  Checkbox,
  DialogActions,
  DialogContent,
  DialogContentText,
  MenuItem,
  Paper,
  Select,
  SelectChangeEvent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material'
import { getRoot } from 'mobx-state-tree'
import React, { useEffect, useState } from 'react'

import { ApolloInternetAccountModel } from '../ApolloInternetAccount/model'
import {
  ApolloInternetAccount,
  CollaborationServerDriver,
} from '../BackendDrivers'
import { ApolloSessionModel } from '../session'
import { ApolloRootModel } from '../types'
import { createFetchErrorMessage } from '../util'
import { Dialog } from './Dialog'

interface ManageChecksProps {
  session: ApolloSessionModel
  handleClose(): void
}

interface AssemblyDocument {
  _id: string
  name: string
  checks: string[]
}

interface CheckDocument {
  _id: string
  name: string
}

export function ManageChecks({ handleClose, session }: ManageChecksProps) {
  const { internetAccounts } = getRoot<ApolloRootModel>(session)
  const [selectedAssembly, setSelectedAssembly] = useState<Assembly>()
  const [errorMessage, setErrorMessage] = useState('')
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
  const [checks, setChecks] = useState<CheckDocument[]>([])
  const [selectedChecks, setSelectedChecks] = useState<string[]>([])

  const { collaborationServerDriver } = session.apolloDataStore as {
    collaborationServerDriver: CollaborationServerDriver
    getInternetAccount(
      assemblyName?: string,
      internetAccountId?: string,
    ): ApolloInternetAccount
  }

  const assemblies = collaborationServerDriver.getAssemblies()

  useEffect(() => {
    async function getChecks() {
      const { baseURL, getFetcher } = selectedInternetAccount
      const uri = new URL('checks/types', baseURL).href
      const apolloFetch = getFetcher({ locationType: 'UriLocation', uri })
      const response = await apolloFetch(uri, { method: 'GET' })
      if (!response.ok) {
        const newErrorMessage = await createFetchErrorMessage(
          response,
          'Error when retrieving checks from server',
        )
        setErrorMessage(newErrorMessage)
        return
      }
      const data = (await response.json()) as CheckDocument[]
      setChecks(data)
    }
    getChecks().catch((error) => {
      setErrorMessage(String(error))
    })
  }, [selectedInternetAccount])

  useEffect(() => {
    if (assemblies.length > 0 && selectedAssembly === undefined) {
      setSelectedAssembly(assemblies[0])
    }
  }, [assemblies, selectedAssembly])

  useEffect(() => {
    async function getChecks() {
      if (!selectedAssembly) {
        return
      }
      const { baseURL, getFetcher } = selectedInternetAccount
      const uri = new URL(`/assemblies/${selectedAssembly.name}`, baseURL).href
      const apolloFetch = getFetcher({ locationType: 'UriLocation', uri })
      const response = await apolloFetch(uri, { method: 'GET' })
      if (!response.ok) {
        const newErrorMessage = await createFetchErrorMessage(
          response,
          'Error when retrieving assembly from server',
        )
        setErrorMessage(newErrorMessage)
        return
      }
      const assembly = (await response.json()) as AssemblyDocument
      setSelectedChecks(assembly.checks)
    }
    getChecks().catch((error) => {
      setErrorMessage(String(error))
    })
  }, [selectedAssembly, selectedInternetAccount])

  function handleChangeAssembly(e: SelectChangeEvent) {
    const newAssembly = assemblies.find((asm) => asm.name === e.target.value)
    setSelectedAssembly(newAssembly)
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedAssembly) {
      setErrorMessage('Must select assembly!')
      return
    }
    const { notify } = session as unknown as AbstractSessionModel
    const { baseURL, getFetcher } = selectedInternetAccount
    const uri = new URL('assemblies/checks', baseURL).href
    const apolloFetch = getFetcher({
      locationType: 'UriLocation',
      uri,
    })
    const response = await apolloFetch(uri, {
      method: 'POST',
      body: JSON.stringify({
        _id: selectedAssembly.name,
        checks: selectedChecks,
        name: '',
      }),
      headers: { 'Content-Type': 'application/json' },
    })
    if (response.ok) {
      notify('Assembly checks updated successfully', 'success')
      handleClose()
    } else {
      const newErrorMessage = await createFetchErrorMessage(
        response,
        'Error when updating assembly checks',
      )
      setErrorMessage(newErrorMessage)
    }
    return
  }

  function handleCheckboxChange(
    e: React.ChangeEvent<HTMLInputElement>,
    checked: boolean,
  ): void {
    const checks = [...selectedChecks]
    const _id = e.target.value
    if (checked) {
      if (!checks.includes(_id)) {
        checks.push(_id)
        setSelectedChecks(checks)
      }
    } else {
      const index = checks.indexOf(_id, 0)
      if (index > -1) {
        checks.splice(index, 1)
      }
      setSelectedChecks(checks)
    }
  }

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

  return (
    <Dialog
      open
      title="Manage Checks"
      handleClose={handleClose}
      data-testid="manage-checks"
    >
      <form onSubmit={onSubmit}>
        <DialogContent>
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
            style={{ width: 300 }}
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
          <br />
          <br />
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Check name</TableCell>
                  <TableCell>Use check</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {checks.map((check) => (
                  <TableRow key={check._id}>
                    <TableCell>{check.name}</TableCell>
                    <TableCell>
                      <Checkbox
                        value={check._id}
                        checked={selectedChecks.includes(check._id)}
                        onChange={handleCheckboxChange}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" type="submit">
            Submit
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
