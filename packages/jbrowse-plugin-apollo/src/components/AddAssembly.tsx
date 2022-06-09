import { AbstractSessionModel, AppRootModel } from '@jbrowse/core/util'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
  TextField,
} from '@material-ui/core'
import { ObjectID } from 'bson'
import { getRoot } from 'mobx-state-tree'
import React, { useState } from 'react'

import { ApolloInternetAccountModel } from '../ApolloInternetAccount/model'

interface AddAssemblyProps {
  session: AbstractSessionModel
  handleClose(): void
}

export function AddAssembly({ session, handleClose }: AddAssemblyProps) {
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
  const [fileType, setFileType] = useState('text/x-gff3')

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
    formData.append('type', fileType)
    const apolloFetchFile = apolloInternetAccount?.getFetcher({
      locationType: 'UriLocation',
      uri: url,
    })
    if (apolloFetchFile) {
      console.log(`File uploaded`)
      await apolloFetchFile(url, {
        method: 'POST',
        body: formData,
      }).then((response) => (await response.json()))
      .then((resp) => {
      console.log(`1File uploaded`)
      console.log(`2File uploaded "${resp}"`)
      console.log(`3File uploaded "${resp.data}"`)
      fileChecksum = resp.data
      })
  //     // console.log(`1Response is ${res.status}`)
  //     if (res.ok) {
  //       // alert('Assembly added succesfully!')
  //     // console.log(`1AResponse is ${res}`)
  //     // console.log(`2AResponse is ${res.text()}`)
  //     // console.log(`3AResponse is ${res.json()}`)
  //     // console.log(`2AResponse is ${(await res.text())}`)
  //     // console.log(`3AResponse is ${(await res.json())}`)
  //     // console.log(`File uploaded "${await res.json()}"`)
  //     // console.log(`1AResponse is ${res.status}`)
  //     console.log(`File uploaded "${(await res.json()).data}"`)
  //     console.log(`1AResponse is ${res.status}`)
  //     fileChecksum = (await res.json()).data
  //   console.log(`File uploaded, file checksum "${fileChecksum}"`)
  // } else {
  //       throw new Error(
  //         `Error when inserting new assembly: ${res.status}, ${res.text}`,
  //       )
  //     }
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
          assemblyId: '624a7e97d45d7745c2532b13', // new ObjectID(),
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
          <FormControl>
            <FormLabel>Select GFF3 or FASTA file</FormLabel>
            <RadioGroup
              aria-labelledby="demo-radio-buttons-group-label"
              defaultValue="text/x-gff3"
              name="radio-buttons-group"
              onChange={(e) => setFileType(e.target.value)}
            >
              <FormControlLabel
                value="text/x-gff3"
                control={<Radio />}
                label="GFF3"
              />
              <FormControlLabel
                value="text/x-fasta"
                control={<Radio />}
                label="FASTA"
              />
            </RadioGroup>
          </FormControl>
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
