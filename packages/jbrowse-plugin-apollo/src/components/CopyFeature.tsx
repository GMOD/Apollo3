/* eslint-disable @typescript-eslint/no-non-null-assertion */
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
  TextField,
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
  const [start, setStart] = useState('')
  const [targetMin, setTargetMin] = useState()
  const [targetMax, setTargetMax] = useState()
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
      // console.log(
      //   `ALL REF NAMES: ${JSON.stringify(allRefNames)}, cnt=${
      //     allRefNames.length
      //   }, ${JSON.stringify(assemblyManager.get(assId))}`,
      // )
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

  async function handleChangeRefSeq(e: SelectChangeEvent<string>) {
    const refSeq = e.target.value as string
    setRefSeqId(refSeq)

    const url = new URL('/features/getStartAndEnd', baseURL)
    const searchParams = new URLSearchParams({
      refSeq,
    })
    url.search = searchParams.toString()
    const uri = url.toString()
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
      setTargetMin(data.minStart)
      setTargetMax(data.maxEnd)
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
    // console.log(`Min start: "${targetMin}"`)
    // console.log(`Max end: "${targetMax}"`)
    // console.log(`Given start: "${start}"`)
    const featureLength =
      Number(sourceFeature.end) - Number(sourceFeature.start)
    // console.log(`Feature lenght: ${featureLength}`)

    if (Number(featureLength) + Number(start) > Number(targetMax!)) {
      setErrorMessage(
        `The selected feature length is ${featureLength} and then maximum start position in the selected target reference sequence is ${
          targetMax! - featureLength
        }.`,
      )
      return
    }
    if (Number(start) < Number(targetMin!)) {
      setErrorMessage(
        `The selected target reference sequence starts at ${targetMin!}`,
      )
      return
    }

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

    const locationMove = Number(start) - newFeatureLine.start
    // console.log(`Location move: ${locationMove}`)
    newFeatureLine.start = Number(start)
    newFeatureLine.end = Number(start) + featureLength
    // Updates children start and end positions accordingly
    const updatedChildren = updateStartAndEnd(newFeatureLine, locationMove)

    const change = new AddFeatureChange({
      changedIds: [newFeatureLine._id],
      typeName: 'AddFeatureChange',
      assembly: assemblyId,
      addedFeature: {
        _id: newFeatureLine._id,
        refSeq: refSeqId,
        start: newFeatureLine.start,
        end: newFeatureLine.end,
        type: newFeatureLine.type,
        children: updatedChildren.children as unknown as Record<
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
   * Recursively loop children and update start and end positions
   * @param feature - parent feature
   * @param locationMove - how much location has been moved from original
   * @returns
   */
  function updateStartAndEnd(
    feature: Feature | AnnotationFeatureSnapshot,
    locationMove: number,
  ): AnnotationFeatureSnapshot {
    const children: Record<string, AnnotationFeatureSnapshot> = {}
    if (feature.children) {
      Object.values(feature.children).forEach((child) => {
        const newChild = updateStartAndEnd(child, locationMove)
        newChild.start = newChild.start + locationMove
        newChild.end = newChild.end + locationMove
        children[newChild._id] = newChild
      })
    }
    const refSeq =
      typeof feature.refSeq === 'string'
        ? feature.refSeq
        : (feature.refSeq as unknown as ObjectID).toHexString()

    const id =
      typeof feature._id === 'string'
        ? feature._id
        : (feature._id as unknown as ObjectID).toHexString()

    return {
      ...feature,
      refSeq,
      children: feature.children && children,
      _id: id,
    }
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
            autoFocus
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
            onChange={handleChangeRefSeq}
          >
            {refNameCollection.map((option) => (
              <MenuItem key={option._id} value={option._id}>
                {option.name}
              </MenuItem>
            ))}
          </Select>
          <DialogContentText>
            Start position in target reference sequence
          </DialogContentText>
          <TextField
            margin="dense"
            id="name"
            // label="Start position"
            type="number"
            fullWidth
            variant="outlined"
            onChange={(e) => {
              // setSubmitted(false)
              setStart(e.target.value)
            }}
            // disabled={submitted && !errorMessage}
          />
        </DialogContent>
        <DialogActions>
          <Button
            disabled={!assemblyId || !refSeqId || !start}
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
