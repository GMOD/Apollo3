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
import { AnnotationFeatureI, AnnotationFeatureSnapshot } from 'apollo-mst'
import { Feature } from 'apollo-schemas'
import { AddFeatureChange } from 'apollo-shared'
import ObjectID from 'bson-objectid'
import { IKeyValueMap } from 'mobx'
import { getRoot, getSnapshot } from 'mobx-state-tree'
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
  const [refNameCollection, setRefNameCollection] = useState<Collection[]>([])
  const [assemblyId, setAssemblyId] = useState('')
  const [refSeqId, setRefSeqId] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const { notify } = session

  async function handleChangeAssembly(e: SelectChangeEvent<string>) {
    const assId = e.target.value as string
    setAssemblyId(assId)
    const { assemblyManager } = getRoot(session)
    if (assemblyManager.get(e.target.value as string).refNames) {
      setRefNameCollection([{ _id: '', name: '' }])

      // Using allRefNames -property we get all reference sequence ids and names. However, all ids are listed first and then the names
      const allRefNames: string[] = await assemblyManager.get(assId).allRefNames
      // console.log(`ALL REF NAMES: ${JSON.stringify(allRefNames)}, cnt=${allRefNames.length}`)
      const halfCount = allRefNames.length / 2
      for (let i = 0; i < halfCount; i++) {
        // console.log(`Id: "${allRefNames[i]}", name: "${allRefNames[i+halfCount]}"`)
        setRefNameCollection((result) => [
          ...result,
          {
            _id: allRefNames[i],
            name: allRefNames[i + halfCount],
          },
        ])
      }
    }
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

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    console.log(`Source feature: "${JSON.stringify(sourceFeature)}"`)

    const featureIds: string[] = []
    // Let's add featureId to each child recursively
    const newFeatureLine = generateNewIds(
      getSnapshot(sourceFeature) as unknown as AnnotationFeatureSnapshot,
      featureIds,
    )
    // Clear possible parentId -attribute
    const attributeMap: IKeyValueMap<string[]> = {
      ...(newFeatureLine.attributes as unknown as IKeyValueMap<string[]>),
    }
    if ('Parent' in attributeMap) {
      delete attributeMap.Parent
    }

    const change = new AddFeatureChange({
      changedIds: [newFeatureLine._id],
      typeName: 'AddFeatureChange',
      assembly: assemblyId,
      addedFeature: {
        _id: newFeatureLine._id,
        refSeq: refSeqId,
        start: Number(newFeatureLine.start),
        end: Number(newFeatureLine.end),
        type: newFeatureLine.type,
        children: newFeatureLine.children as unknown as Record<
          string,
          AnnotationFeatureSnapshot
        >,
        attributes: attributeMap,
        discontinuousLocations: newFeatureLine.discontinuousLocations,
        strand: newFeatureLine.strand,
        score: newFeatureLine.score,
        phase: newFeatureLine.phase,
      },
      copyFeature: true,
      allIds: featureIds,
    })
    changeManager.submit?.(change)

    notify(`Feature copied successfully`, 'success')
    handleClose()
    event.preventDefault()
  }

  /**
   * Recursively assign new IDs to a feature
   * @param feature - Parent feature
   * @param featureIds -
   */
  function generateNewIds(
    // feature: AnnotationFeatureSnapshot,
    feature: Feature | AnnotationFeatureSnapshot,
    featureIds: string[],
  ): AnnotationFeatureSnapshot {
    const newId = new ObjectID().toHexString()
    featureIds.push(newId)

    const children: Record<string, AnnotationFeatureSnapshot> = {}
    if (feature.children) {
      Object.values(feature.children).forEach((child) => {
        const newChild = generateNewIds(child, featureIds)
        children[newChild._id] = newChild
      })
    }
    const refSeq =
      typeof feature.refSeq === 'string'
        ? feature.refSeq
        : (feature.refSeq as unknown as ObjectID).toHexString()

    return {
      ...feature,
      refSeq,
      children: feature.children && children,
      _id: newId,
    }
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
          <DialogContentText>Target reference sequence</DialogContentText>
          <Select
            labelId="label"
            value={refSeqId}
            onChange={(e) => {
              setRefSeqId(e.target.value)
            }}
          >
            {refNameCollection.map((option) => (
              <MenuItem key={option._id} value={option._id}>
                {option.name}
              </MenuItem>
            ))}
          </Select>
        </DialogContent>
        <DialogActions>
          <Button
            disabled={!assemblyId || !refSeqId}
            variant="contained"
            type="submit"
          >
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
