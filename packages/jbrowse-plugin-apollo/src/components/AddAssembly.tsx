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
import axios from 'axios'
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
  const [file, setFile] = useState<any>()
  // //   const [setAssemblyDesc, setAssemblyDesc] = useState('')

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
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
    // *** FILE UPLOAD STARTS ****
    let fileChecksum = ''
    const url = new URL('/files', baseURL).href
    const formData = new FormData()
    formData.append('file', file)
    formData.append('fileName', file.name)
    formData.append('type', 'text/x-gff3') // How to decide value here?
    const config = {
      headers: {
        'content-type': 'multipart/form-data',
      },
    }
    await axios.post(url, formData, config).then((response: any) => {
      console.log(`Response is ${response.status}`)
      fileChecksum = response.data
    })
    console.log(`File uploaded, file checksum "${fileChecksum}"`)
    // *** FILE UPLOAD ENDS ****

    // *** NEW FETCH STARTS *****
    const uri = new URL('/changes/submitChange', baseURL).href
// const apolloFetch = apolloInternetAccount.getFetcher({
//   locationType: 'UriLocation',
//   uri,
// })
// const res2 = await apolloFetch(uri, { //...})
    // *** NEW FETCH STARTS *****

    console.log(`Assembly name is "${assemblyName}"`)
    const res = await fetch(new URL('/changes/submitChange', baseURL).href, {
      method: 'POST',
      body: JSON.stringify({
        changedIds: ['1'],
        typeName: 'AddAssemblyFromFileChange',
        assemblyId: '624a7e97d45d7745c2532b03', // How to get this id?
        fileChecksum, // This is uploaded GFF3 file checksum
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
          <DialogContentText>Enter new assembly info</DialogContentText>
          <h3>Upload GFF3 file</h3>
          {/* <input type="file" onChange={(e) => setFile(e.target.value)} /> */}
          <input type="file" onChange={handleChange} />
          {/* <button type="submit">Upload</button> */}
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
