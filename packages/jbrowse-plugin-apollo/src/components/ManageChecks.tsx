/* eslint-disable @typescript-eslint/use-unknown-in-catch-callback-variable */
/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-misused-promises */
import { readConfObject } from '@jbrowse/core/configuration'
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

import type { ApolloSessionModel } from '../session'
import { createFetchErrorMessage, getApolloAssemblyId } from '../util'

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

  const { assemblies } = (session as unknown as AbstractSessionModel)
    .assemblyManager
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
        `assemblies/${getApolloAssemblyId(selectedAssembly)}`,
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
        _id: getApolloAssemblyId(selectedAssembly),
        checks: selectedChecks,
        name: '',
      }),
      headers: { 'Content-Type': 'application/json' },
    })
    if (response.ok) {
      notify('Assembly checks updated successfully', 'success')
      // Registering/unregistering checks doesn't touch any feature document,
      // so nothing pushes an update to already-loaded clients (no socket
      // event is emitted for it). Refetch and reconcile this assembly's
      // check results here so results for now-unregistered checks disappear
      // immediately instead of only after the next full reload.
      const { apolloDataStore } = session
      const assemblyId = getApolloAssemblyId(selectedAssembly)
      const backendDriver = apolloDataStore.getBackendDriver(assemblyId)
      const assembly = apolloDataStore.getAssemblyByName(selectedAssembly.name)
      if (backendDriver && assembly) {
        const allFreshResults = await backendDriver.getCheckResults(
          selectedAssembly.name,
        )
        // getCheckResults returns results for the whole assembly, but the
        // client has only loaded features for whatever's currently visible.
        // Adding a result whose feature isn't loaded leaves its `ids`
        // safeReference permanently unresolved, which throws (rather than
        // just being empty) the next time the session's snapshot is taken -
        // e.g. by the periodic location-heartbeat POST. Only reconcile
        // results for features that are actually in the tree already.
        const freshResults = allFreshResults.filter((r) => {
          const refSeq = assembly.refSeqs.get(r.refSeq)
          return r.ids.some((id) => refSeq?.features.has(id))
        })
        const freshIds = new Set(freshResults.map((r) => r._id))
        const refSeqIds = new Set(assembly.refSeqs.keys())
        const staleIds = [...apolloDataStore.checkResults.values()]
          .filter((cr) => refSeqIds.has(cr.refSeq) && !freshIds.has(cr._id))
          .map((cr) => cr._id)
        for (const staleId of staleIds) {
          apolloDataStore.deleteCheckResult(staleId)
        }
        apolloDataStore.addCheckResults(freshResults)
      }
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
                {/* @ts-expect-error not right here */}
                {readConfObject(option, 'displayName') ?? option.name}
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
