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

interface ImportFeaturesProps {
  session: AbstractSessionModel
  handleClose(): void
}

export function ImportFeatures({ session, handleClose }: ImportFeaturesProps) {
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
  const [collection, setCollection] = React.useState<any[]>([])

  const options = [
    { label: 'Fruit', value: 'fruit' },
    { label: 'Vegetable', value: 'vegetable' },
    { label: 'Meat', value: 'meat' },
  ]
  const [value, setValue] = React.useState('fruit')

  // *** NEW FETCH STARTS *****
  const uri = new URL('/assemblies', baseURL).href
  const apolloFetch = apolloInternetAccount?.getFetcher({
    locationType: 'UriLocation',
    uri,
  })
  console.log(`Assemblies get starts...`)
  if (apolloFetch) {
    apolloFetch(uri, {
      method: 'GET',
    })
      .then((response) => response.json())
      //   .then((res) => setCollection(res))
      .then((res) => {
        console.log(JSON.stringify(res))
        res.forEach((item: any) => {
          console.log(`Id: ${item._id}`)
          console.log(`Name: ${item.name}`)
          options.push({ label: 'item._id2', value: 'item.name2' })
          setCollection((oldArray) => [...oldArray, res])
          console.log(`1collection "${collection}"`)
        })
      })
    // .then((res) => this.setState({ collection: res }))
  }
  console.log(`Assemblies get done`)
  console.log(`2collection "${collection}"`)
  // *** NEW FETCH ENDS *****
  options.push({ label: 'item._id3', value: 'item.name3' })

  function handleChangeFruit(e: React.ChangeEvent<HTMLSelectElement>) {
    setValue(e.target.value)
  }

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

    // *** CURRENT FETCH STARTS *****
    console.log(`Assembly name is "${assemblyName}"`)
    const res = await fetch(new URL('/changes/submitChange', baseURL).href, {
      method: 'POST',
      body: JSON.stringify({
        changedIds: ['1'],
        typeName: 'ImportFeaturesFromFileChange',
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
    // *** CURRENT FETCH ENDS *****
    // make sure response is ok and then reload page
    handleClose()
    event.preventDefault()
  }

  return (
    <Dialog open maxWidth="xl" data-testid="login-apollo">
      <DialogTitle>Import Features</DialogTitle>
      <form onSubmit={onSubmit}>
        <div>
          <label>
            What do we eat?
            <select value={value} onChange={handleChangeFruit}>
              {options.map((option) => (
                <option value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <p>We eat today {value}!</p>
        </div>
        <DialogContent style={{ display: 'flex', flexDirection: 'column' }}>
          <DialogContentText>Enter new assembly info</DialogContentText>
          <h4>Upload GFF3 or FASTA file</h4>
          {/* <input type="file" onChange={(e) => setFile(e.target.value)} /> */}
          <input type="file" onChange={handleChange} />
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
