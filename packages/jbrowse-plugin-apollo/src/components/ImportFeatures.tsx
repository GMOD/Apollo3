import { AbstractSessionModel, AppRootModel } from '@jbrowse/core/util'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from '@material-ui/core'
import axios from 'axios'
import { getRoot } from 'mobx-state-tree'
import React, { useState } from 'react'

import { ApolloInternetAccountModel } from '../ApolloInternetAccount/model'

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
//   const [collection, setCollection] = React.useState<any[]>([])

  const options = [
    { label: '', value: '' },
    { label: 'hardcoded assembly name', value: '624a7e97d45d7745c2532b03' },
  ]
  const [assemblyId, setValue] = React.useState('')

  console.log(`getAssemblies() call starts...`)
  getAssemblies()
  console.log(`getAssemblies() call ended`)

  function handleChangeAssembly(e: React.ChangeEvent<HTMLSelectElement>) {
    setValue(e.target.value)
    const ind = e.target.selectedIndex
    setAssemblyName(e.target[ind].innerText)
  }

  function handleChangeFile(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) {
      return
    }
    setFile(e.target.files[0])
  }

  // Get assemblies **** DOES NOT WORK ****
  async function getAssemblies() {
    const uri = new URL('/assemblies', baseURL).href
    const apolloFetch = apolloInternetAccount?.getFetcher({
      locationType: 'UriLocation',
      uri,
    })
    if (apolloFetch) {
      await apolloFetch(uri, {
        method: 'GET',
      })
        .then((response) => response.json())
        .then((res) => {
          console.log(JSON.stringify(res))
          //   res.forEach((item: any) => {
          //     // console.log(`Id: ${item._id}`)
          //     // console.log(`Name: ${item.name}`)
          //   })
          options.push({ label: 'demo123', value: 'demoValue123' })
        })
    }
    console.log(`getAssemblies() finished`)
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
    formData.append('type', 'text/x-gff3')
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
    console.log(`AssemblyId is "${assemblyId}"`)
    const res = await fetch(new URL('/changes/submitChange', baseURL).href, {
      method: 'POST',
      body: JSON.stringify({
        changedIds: ['1'],
        typeName: 'AddFeaturesFromFileChange',
        assemblyId,
        fileChecksum,
        assemblyName,
      }),
      headers: new Headers({
        Authorization: `Bearer ${sessionToken}`,
        'Content-Type': 'application/json',
      }),
    })
    console.log(`Response is ${res.status}`)
    if (res.ok) {
      alert('Features added succesfully!')
    } else {
      throw new Error(
        `Error when inserting new features: ${res.status}, ${res.text}`,
      )
    }
    handleClose()
    event.preventDefault()
  }

  return (
    <Dialog open maxWidth="xl" data-testid="login-apollo">
      <DialogTitle>Import Features from GFF3 file</DialogTitle>
      <form onSubmit={onSubmit}>
        <DialogContent style={{ display: 'flex', flexDirection: 'column' }}>
          <h4>Select assembly</h4>
          <select value={assemblyId} onChange={handleChangeAssembly}>
            {options.map((option) => (
              <option value={option.value}>{option.label}</option>
            ))}
          </select>
          <h4>Upload GFF3 to load features</h4>
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
