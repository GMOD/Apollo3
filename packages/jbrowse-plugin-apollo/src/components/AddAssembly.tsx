import { AbstractSessionModel, AppRootModel } from '@jbrowse/core/util'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
} from '@material-ui/core'
import { getRoot } from 'mobx-state-tree'
import React, { useState } from 'react'

import { ApolloInternetAccountModel } from '../ApolloInternetAccount/model'
import { ViewModel } from './stateModel'

interface AddAssemblyProps {
  session: AbstractSessionModel
  handleClose(): void
}

export function AddAssembly({ session, handleClose }: AddAssemblyProps) {
  // export function AddAssembly({ session, handleClose }: AddAssemblyProps) {
  const { internetAccounts } = getRoot(session) as AppRootModel
  const apolloInternetAccount = internetAccounts.find(
    (ia) => ia.type === 'ApolloInternetAccount',
  ) as ApolloInternetAccountModel | undefined
  if (!apolloInternetAccount) {
    throw new Error('No Apollo internet account found')
  }
  const { baseURL, internetAccountId } = apolloInternetAccount
  const [assemblyName, setAssemblyName] = useState('')
//   const [setAssemblyDesc, setAssemblyDesc] = useState('')

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const sessionToken = sessionStorage.getItem('apolloInternetAccount-token')
    if (sessionToken == null) {
      alert('You must authenticate first!')
      return
    }
    console.log(`Assembly name is "${assemblyName}"`)

    const res = await fetch(new URL('/changes/submitChange', baseURL).href, {
      method: 'POST',
      body: JSON.stringify({
        changedIds: ['1'],
        typeName: 'AddAssemblyFromFileChange',
        assemblyId: '624a7e97d45d7745c2532b03',
        fileChecksum: '83d5568fdd38026c75a3aed528e9e81d', // This is uploaded GFF3 file checksum
        assemblyName,
      }),
      headers: new Headers({
        Authorization: `Bearer ${sessionToken}`,
        'Content-Type': 'application/json',
      }),
    })
    console.log(`Response is ${res.status}`)
    if (res.ok) {
      alert('Assembly added succesfully!')
    } else {
      throw new Error(
        `Error when inserting new assembly: ${res.status}, ${res.text}`,
      )
    }
    // make sure response is ok and then reload page
    handleClose()
    event.preventDefault()
  }

  return (
    <Dialog open maxWidth="xl" data-testid="login-apollo">
      <DialogTitle>Add assembly to {internetAccountId}</DialogTitle>
      <form onSubmit={onSubmit}>
        <DialogContent style={{ display: 'flex', flexDirection: 'column' }}>
          <DialogContentText>Enter new assembly information</DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            id="name"
            label="Assembly name"
            type="TextField"
            fullWidth
            variant="standard"
            onChange={(e) => setAssemblyName(e.target.value)}
          />
          <TextField
            margin="dense"
            id="description"
            label="Assembly description"
            type="TextField"
            fullWidth
            variant="standard"
            // onChange={(e) => setAssemblyDesc(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button variant="contained" color="primary" type="submit">
            Submit
          </Button>
          <Button
            variant="contained"
            color="default"
            type="submit"
            onClick={() => {
              handleClose()
            }}
          >
            Cancel
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
