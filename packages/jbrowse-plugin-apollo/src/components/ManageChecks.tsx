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
import { getRoot } from 'mobx-state-tree'
import React, { useEffect, useState } from 'react'

import { ApolloInternetAccountModel } from '../ApolloInternetAccount/model'
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
  const apolloInternetAccount = internetAccounts.find(
    (ia) => ia.type === 'ApolloInternetAccount',
  ) as ApolloInternetAccountModel | undefined
  if (!apolloInternetAccount) {
    throw new Error('No Apollo internet account found')
  }
  const { baseURL } = apolloInternetAccount
  const [errorMessage, setErrorMessage] = useState<string>()
  const [assemblyCollection, setAssemblyCollection] = useState<
    AssemblyDocument[]
  >([])
  const [allCheckCollection, setAllCheckCollection] = useState<CheckDocument[]>(
    [],
  )

  const [assemblyId, setAssemblyId] = useState<string>('')
  const [selectedChecks, setSelectedChecks] = useState<string[]>([])

  useEffect(() => {
    async function getAssemblies() {
      const uri = new URL('/assemblies', baseURL).href
      const apolloFetch = apolloInternetAccount?.getFetcher({
        locationType: 'UriLocation',
        uri,
      })
      if (apolloFetch) {
        const response = await apolloFetch(uri, { method: 'GET' })
        if (!response.ok) {
          const newErrorMessage = await createFetchErrorMessage(
            response,
            'Error when retrieving assemblies from server',
          )
          setErrorMessage(newErrorMessage)
          return
        }
        const data = (await response.json()) as AssemblyDocument[]
        setAssemblyCollection(data)
      }
    }
    async function getChecks() {
      const uri = new URL('/checks/types', baseURL).href
      const apolloFetch = apolloInternetAccount?.getFetcher({
        locationType: 'UriLocation',
        uri,
      })
      if (apolloFetch) {
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
        setAllCheckCollection(data)
      }
    }
    getAssemblies().catch((error) => setErrorMessage(String(error)))
    getChecks().catch((error) => setErrorMessage(String(error)))
  }, [apolloInternetAccount, baseURL])

  useEffect(() => {
    if (!assemblyId && assemblyCollection.length > 0) {
      setAssemblyId(assemblyCollection[0]._id)
      setSelectedChecks(assemblyCollection[0].checks)
    }
  }, [assemblyId, assemblyCollection])

  async function handleChangeAssembly(e: SelectChangeEvent<string>) {
    const assId = e.target.value as string
    setAssemblyId(assId)
    const result = assemblyCollection.find(({ _id }) => _id === assId)
    if (result?.checks) {
      setSelectedChecks(result?.checks)
    } else {
      setSelectedChecks([])
    }
  }

  // eslint-disable-next-line unicorn/consistent-function-scoping
  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const { notify } = session as unknown as AbstractSessionModel
    const uri = new URL('/assemblies/checks', baseURL).href
    const apolloFetch = apolloInternetAccount?.getFetcher({
      locationType: 'UriLocation',
      uri,
    })
    if (apolloFetch) {
      const response = await apolloFetch(uri, {
        method: 'POST',
        body: JSON.stringify({
          _id: assemblyId,
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
  }

  // eslint-disable-next-line unicorn/consistent-function-scoping
  function handleCheckboxChange(
    e: React.ChangeEvent<HTMLInputElement>,
    _id: string,
  ): void {
    const checks = selectedChecks as string[]
    if (e.target.checked && !checks.includes(_id)) {
      checks.push(_id)
      setSelectedChecks(checks)
    }
    if (!e.target.checked) {
      const index = checks.indexOf(_id, 0)
      if (index > -1) {
        checks.splice(index, 1)
      }
      setSelectedChecks(checks)
    }
  }

  // eslint-disable-next-line unicorn/consistent-function-scoping
  function getCheck(_id: string): boolean {
    // TODO: GARRETT
    return selectedChecks.includes(_id) || false
  }

  return (
    <Dialog
      open
      style={{
        width: '500px',
        position: 'fixed',
        left: '50%',
      }}
      title="Manage Checks"
      handleClose={handleClose}
      data-testid="manage-checks"
    >
      <Select
        style={{ width: 300, marginLeft: 40 }}
        value={assemblyId}
        onChange={handleChangeAssembly}
      >
        {assemblyCollection.map((option) => (
          <MenuItem key={option._id} value={option._id}>
            {option.name}
          </MenuItem>
        ))}
      </Select>
      <br />
      <br />
      <form onSubmit={onSubmit}>
        <table style={{ width: 300, marginLeft: 40 }}>
          <thead>
            <tr
              style={{
                textAlign: 'left',
              }}
            >
              <th>Check name</th>
              <th>Use check</th>
            </tr>
          </thead>
          <tbody>
            {allCheckCollection.map((check) => (
              <tr key={check._id}>
                <td>{check.name}</td>
                <td>
                  <input
                    type="checkbox"
                    // checked={getCheck(check._id)} // TODO: GARRETT
                    onChange={(e) => handleCheckboxChange(e, check._id)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
