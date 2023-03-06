import { AbstractSessionModel, AppRootModel } from '@jbrowse/core/util'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  MenuItem,
  Select,
  SelectChangeEvent,
} from '@mui/material'
import { AnnotationFeatureI } from 'apollo-mst'
import { AddFeatureChange, CopyFeatureChange } from 'apollo-shared'
import ObjectID from 'bson-objectid'
import { getRoot } from 'mobx-state-tree'
import React, { useEffect, useState } from 'react'

import { ApolloInternetAccountModel } from '../ApolloInternetAccount/model'
import { ChangeManager } from '../ChangeManager'
import { createFetchErrorMessage } from '../util'

interface CopyFeatureProps {
  session: AbstractSessionModel
  handleClose(): void
  sourceFeature: AnnotationFeatureI
  sourceFeatureId: string
  sourceAssemblyId: string
  changeManager: ChangeManager
}

interface Collection {
  _id: string
  name: string
}

export function CopyFeature({
  session,
  handleClose,
  sourceFeatureId,
  sourceAssemblyId,
  changeManager,
  sourceFeature,
}: CopyFeatureProps) {
  const { internetAccounts } = getRoot(session) as AppRootModel
  const apolloInternetAccount = internetAccounts.find(
    (ia) => ia.type === 'ApolloInternetAccount',
  ) as ApolloInternetAccountModel | undefined
  if (!apolloInternetAccount) {
    throw new Error('No Apollo internet account found')
  }
  const { baseURL } = apolloInternetAccount
  const [collection, setCollection] = useState<Collection[]>([])
  const [assemblyId, setAssemblyId] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const { notify } = session

  function handleChangeAssembly(e: SelectChangeEvent<string>) {
    setAssemblyId(e.target.value as string)
  }

  useEffect(() => {
    async function getAssemblies() {
      const uri = new URL('/assemblies', baseURL).href
      const apolloFetch = apolloInternetAccount?.getFetcher({
        locationType: 'UriLocation',
        uri,
      })
      if (apolloFetch) {
        const response = await apolloFetch(uri, {
          method: 'GET',
        })
        if (!response.ok) {
          const newErrorMessage = await createFetchErrorMessage(
            response,
            'Error when copying features',
          )
          setErrorMessage(newErrorMessage)
          return
        }
        const data = await response.json()
        data.forEach((item: Collection) => {
          // Do not show source assembly in the list of target assemblies
          if (item._id !== sourceAssemblyId) {
            setCollection((result) => [
              ...result,
              {
                _id: item._id,
                name: item.name,
              },
            ])
          }
        })
      }
    }
    getAssemblies()
    return () => {
      setCollection([{ _id: '', name: '' }])
    }
  }, [apolloInternetAccount, baseURL, sourceAssemblyId, sourceFeatureId])

  // async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
  //   event.preventDefault()
  //   setErrorMessage('')
  //   const newFeatureId = new ObjectID().toHexString()
  //   const change = new CopyFeatureChange({
  //     changedIds: [newFeatureId],
  //     typeName: 'CopyFeatureChange',
  //     assembly: sourceAssemblyId,
  //     featureId: sourceFeatureId,
  //     newFeatureId,
  //     targetAssemblyId: assemblyId,
  //   })
  //   changeManager.submit(change)
  //   handleClose()
  // }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    // Get target refSeqId from target assembly
    const targetRefSeqId = await getRefSeqId(assemblyId, sourceFeature.refSeq)
    console.log(`Target refSeqId: ${targetRefSeqId}`)
    console.log(`Source ID: ${sourceFeature._id}`)
    if (!targetRefSeqId) {
      setErrorMessage(`Target assembly does not have same reference sequence!`)
      return
    }

    const newFeatureId = new ObjectID().toHexString()
    // if (sourceFeature.children) {
    //   const change1 = new AddFeatureChange({
    //     changedIds: [newFeatureId],
    //     typeName: 'AddFeatureChange',
    //     assembly: assemblyId,
    //     addedFeature: {
    //       _id: new ObjectID().toHexString(),
    //       refSeq: targetRefSeqId,
    //       start: Number(sourceFeature.start),
    //       end: Number(sourceFeature.end),
    //       type: sourceFeature.type,
    //       children: sourceFeature.children!,
    //       attributes: sourceFeature.attributes,
    //     },
    //     parentFeatureId: sourceFeature._id,
    //   })
    // }
    //********* JATKA TÄSTÄ : MITEN SAA KOPIOITAVAN FEATUREN MYÖS LAPSET KOPIOITUA TARGET ASSEMBLYYN
    // PITÄÄ MYÖS GENEROIDA UUDET TUNNISTEET allIds -kenttään

    if (sourceFeature.children && sourceFeature.attributes) {
      const change = new AddFeatureChange({
        changedIds: [newFeatureId],
        typeName: 'AddFeatureChange',
        assembly: assemblyId,
        addedFeature: {
          _id: new ObjectID().toHexString(),
          refSeq: targetRefSeqId,
          start: Number(sourceFeature.start),
          end: Number(sourceFeature.end),
          type: sourceFeature.type,
          children: sourceFeature.children!,
          attributes: sourceFeature.attributes!,
        },
        parentFeatureId: sourceFeature._id,
      })
      changeManager.submit?.(change)  
    }
    notify(`Feature copied successfully`, 'success')
    handleClose()
    event.preventDefault()
  }

  async function getRefSeqId(targetAssemblyId: string, sourceRefSeq: string) {
    let sourceRefSeqName = ''
    let targetRefSeqId
    const url = `/refSeqs/${sourceRefSeq}`
    let uri = new URL(url, baseURL).href

    let apolloFetch = apolloInternetAccount?.getFetcher({
      locationType: 'UriLocation',
      uri,
    })
    if (apolloFetch) {
      const response = await apolloFetch(uri, {
        method: 'GET',
      })
      if (!response.ok) {
        const newErrorMessage = await createFetchErrorMessage(
          response,
          'Error when copying features',
        )
        setErrorMessage(newErrorMessage)
        return
      }
      const data = await response.json()
      if (data) {
        sourceRefSeqName = data.name
      }
      console.log(`sourceRefSeqName: ${sourceRefSeqName}`)
    }

    const url2 = new URL('refSeqs', baseURL)
    const searchParams = new URLSearchParams({ assembly: targetAssemblyId })
    url2.search = searchParams.toString()
    uri = url2.toString()

    apolloFetch = apolloInternetAccount?.getFetcher({
      locationType: 'UriLocation',
      uri,
    })
    if (apolloFetch) {
      const response = await apolloFetch(uri, {
        method: 'GET',
      })
      if (!response.ok) {
        const newErrorMessage = await createFetchErrorMessage(
          response,
          'Error when retrieving refSeq data from server',
        )
        setErrorMessage(newErrorMessage)
        return
      }
      const data = await response.json()
      console.log(`DATA: ${JSON.stringify(data)}`)
      data.forEach((item: Collection) => {
        if (item.name === sourceRefSeqName) {
          targetRefSeqId = item._id
        }
      })
    }
    return targetRefSeqId
  }
  return (
    <Dialog open maxWidth="xl" data-testid="login-apollo">
      <DialogTitle>Copy features and annotations</DialogTitle>
      <form onSubmit={onSubmit}>
        <DialogContent style={{ display: 'flex', flexDirection: 'column' }}>
          <DialogContentText>Target assembly</DialogContentText>
          <Select
            labelId="label"
            value={assemblyId}
            onChange={handleChangeAssembly}
          >
            {collection.map((option) => (
              <MenuItem key={option._id} value={option._id}>
                {option.name}
              </MenuItem>
            ))}
          </Select>
        </DialogContent>
        <DialogActions>
          <Button disabled={!assemblyId} variant="contained" type="submit">
            Submit
          </Button>
          <Button
            variant="outlined"
            type="submit"
            onClick={() => {
              handleClose()
            }}
          >
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
