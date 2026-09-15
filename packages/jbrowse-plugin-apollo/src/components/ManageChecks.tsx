/* eslint-disable @typescript-eslint/use-unknown-in-catch-callback-variable */
/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-misused-promises */
import type { AbstractSessionModel } from '@jbrowse/core/util'
import {
  Button,
  Checkbox,
  DialogActions,
  DialogContent,
  DialogContentText,
  MenuItem,
  Paper,
  Select,
  type SelectChangeEvent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material'
import React, { useEffect, useState } from 'react'

import type { CollaborationServerDriver } from '../BackendDrivers'
import type { ApolloSessionModel } from '../session'
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
  const [errorMessage, setErrorMessage] = useState('')

  const { collaborationServerDriver } = session.apolloDataStore as {
    collaborationServerDriver: CollaborationServerDriver
  }

  const assemblies = collaborationServerDriver.getAssemblies()
  const [selectedAssembly, setSelectedAssembly] = useState(assemblies.at(0))
  const [checks, setChecks] = useState<CheckDocument[]>([])
  const [selectedChecks, setSelectedChecks] = useState<string[]>([])

  useEffect(() => {
    async function getChecks() {
      const uri = new URL('checks/types', globalThis.location.href).href
      const response = await fetch(uri, { method: 'GET' })
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
  }, [])

  useEffect(() => {
    async function getChecks() {
      if (!selectedAssembly) {
        return
      }
      const uri = new URL(
        `assemblies/${selectedAssembly.name}`,
        globalThis.location.href,
      ).href
      const response = await fetch(uri, { method: 'GET' })
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
  }, [selectedAssembly])

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
    const uri = new URL('assemblies/checks', globalThis.location.href).href
    const response = await fetch(uri, {
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
      if (index !== -1) {
        checks.splice(index, 1)
      }
      setSelectedChecks(checks)
    }
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
                {option.displayName}
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
