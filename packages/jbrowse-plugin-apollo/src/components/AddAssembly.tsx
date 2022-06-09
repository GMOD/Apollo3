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
import { ObjectID } from 'bson'

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
  const [file, setFile] = useState<any>()
  const [assemblyDesc, setAssemblyDesc] = useState('')

  function handleChangeFile(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) {
      return
    }
    setFile(e.target.files[0])
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const sessionToken = sessionStorage.getItem('apolloInternetAccount-token')
    if (sessionToken == null) {
      alert('You must authenticate first!')
      return
    }

    let fileChecksum = ''
    const url = new URL('/files', baseURL).href
    const formData = new FormData()
    formData.append('file', file)
    formData.append('fileName', file.name)
    formData.append('type', 'text/x-gff3') // How to decide value here?
    const apolloFetchFile = apolloInternetAccount?.getFetcher({
      locationType: 'UriLocation',
      uri: url,
    })
    if (apolloFetchFile) {
      const res = await apolloFetchFile(url, {
        method: 'POST',
        body: formData,
      })
      console.log(`Response is ${res.status}`)
      if (res.ok) {
        alert('Assembly added succesfully!')
        fileChecksum = (await res.json()).data
      } else {
        throw new Error(
          `Error when inserting new assembly: ${res.status}, ${res.text}`,
        )
      }
    }
    console.log(`File uploaded, file checksum "${fileChecksum}"`)

    const uri = new URL('/changes/submitChange', baseURL).href
    const apolloFetch = apolloInternetAccount?.getFetcher({
      locationType: 'UriLocation',
      uri,
    })
    if (apolloFetch) {
      const res = await apolloFetch(uri, {
        method: 'POST',
        body: JSON.stringify({
          changedIds: ['1'],
          typeName: 'AddAssemblyFromFileChange',
          assemblyId: new ObjectID(),
          fileChecksum,
          assemblyName,
        }),
        headers: new Headers({
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
    }
    // make sure response is ok and then reload page
    handleClose()
    event.preventDefault()
  }

  return (
    <Dialog open maxWidth="xl" data-testid="login-apollo">
      <DialogTitle>Add new assembly</DialogTitle>
      <form onSubmit={onSubmit}>
        <DialogContent style={{ display: 'flex', flexDirection: 'column' }}>
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
            onChange={(e) => setAssemblyDesc(e.target.value)}
          />
          <h4>Select GFF3 or FASTA file</h4>
          <input type="file" onChange={handleChangeFile} />
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
