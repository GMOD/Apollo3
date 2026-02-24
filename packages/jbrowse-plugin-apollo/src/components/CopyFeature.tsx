/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/use-unknown-in-catch-callback-variable */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import type {
  AnnotationFeature,
  AnnotationFeatureSnapshot,
} from '@apollo-annotation/mst'
import { AddFeatureChange } from '@apollo-annotation/shared'
import { readConfObject } from '@jbrowse/core/configuration'
import type { AbstractSessionModel } from '@jbrowse/core/util'
import { getSnapshot } from '@jbrowse/mobx-state-tree'
import {
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
  MenuItem,
  Select,
  type SelectChangeEvent,
  TextField,
} from '@mui/material'
import ObjectID from 'bson-objectid'
import type { IKeyValueMap } from 'mobx'
import React, { useEffect, useState } from 'react'

import type { ChangeManager } from '../ChangeManager'
import type { ApolloSessionModel } from '../session'

import { Dialog } from './Dialog'

interface CopyFeatureProps {
  session: ApolloSessionModel
  handleClose(): void
  sourceFeature: AnnotationFeature
  sourceAssemblyId: string
  changeManager: ChangeManager
}

interface Collection {
  _id: string
  name: string
}

/**
 * Recursively assign new IDs to a feature
 * @param feature - Parent feature
 * @param featureIds -
 */
function generateNewIds(
  // feature: AnnotationFeatureSnapshot,
  feature: AnnotationFeatureSnapshot,
  featureIds: string[],
): AnnotationFeatureSnapshot {
  const newId = new ObjectID().toHexString()
  featureIds.push(newId)

  const children: Record<string, AnnotationFeatureSnapshot> = {}
  if (feature.children) {
    for (const child of Object.values(feature.children)) {
      const newChild = generateNewIds(child, featureIds)
      children[newChild._id] = newChild
    }
  }
  const referenceSeq =
    typeof feature.refSeq === 'string'
      ? feature.refSeq
      : (feature.refSeq as unknown as ObjectID).toHexString()

  return {
    ...feature,
    refSeq: referenceSeq,
    children: feature.children && children,
    _id: newId,
  }
}

export function CopyFeature({
  changeManager,
  handleClose,
  session,
  sourceAssemblyId,
  sourceFeature,
}: CopyFeatureProps) {
  const { assemblyManager } = session as unknown as AbstractSessionModel
  const assemblies = assemblyManager.assemblyList

  const [selectedAssemblyId, setSelectedAssemblyId] = useState<
    string | undefined
  >(assemblies.find((a) => a.name !== sourceAssemblyId)?.name)
  const [refNames, setRefNames] = useState<Collection[]>([])
  const [selectedRefSeqId, setSelectedRefSeqId] = useState('')
  const [start, setStart] = useState(sourceFeature.min)
  const [errorMessage, setErrorMessage] = useState('')

  function handleChangeAssembly(e: SelectChangeEvent) {
    setSelectedAssemblyId(e.target.value)
  }

  useEffect(() => {
    async function getRefNames() {
      setSelectedRefSeqId('')
      if (!selectedAssemblyId) {
        setErrorMessage('No assemblies to copy to')
        return
      }
      const assembly = await assemblyManager.waitForAssembly(selectedAssemblyId)
      if (!assembly) {
        return
      }
      const { refNameAliases } = assembly
      if (!refNameAliases) {
        return
      }
      const newRefNames = [...Object.entries(refNameAliases)]
        .filter(([id, refName]) => id !== refName)
        .map(([id, refName]) => ({ _id: id, name: refName }))
      setRefNames(newRefNames)
      setSelectedRefSeqId(newRefNames[0]?._id || '')
    }
    getRefNames().catch((error) => {
      setErrorMessage(String(error))
    })
  }, [selectedAssemblyId, assemblyManager])

  function handleChangeRefSeq(e: SelectChangeEvent) {
    const refSeq = e.target.value
    setSelectedRefSeqId(refSeq)
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (!selectedAssemblyId) {
      return
    }
    event.preventDefault()
    setErrorMessage('')
    const featureLength = sourceFeature.length
    const assembly = await assemblyManager.waitForAssembly(selectedAssemblyId)
    if (!assembly) {
      setErrorMessage(`Assembly not found: ${selectedAssemblyId}.`)
      return
    }
    const canonicalRefName = assembly.getCanonicalRefName(selectedRefSeqId)
    const region = assembly.regions?.find((r) => r.refName === canonicalRefName)
    if (!region) {
      setErrorMessage(`RefSeq not found: ${selectedRefSeqId}.`)
      return
    }

    const newEnd = start + featureLength
    if (newEnd > region.end) {
      setErrorMessage(
        `Feature would extend beyond the bounds of the selected reference sequence. (Feature would end at ${newEnd}, but reference sequence ends at ${region.end})`,
      )
      return
    }
    if (start < region.start) {
      setErrorMessage(
        `Reference sequence starts at ${region.start}, feature cannot start before that.`,
      )
      return
    }

    const featureIds: string[] = []
    // Let's add featureId to each child recursively
    const newFeatureLine = generateNewIds(
      getSnapshot(sourceFeature) as unknown as AnnotationFeatureSnapshot,
      featureIds,
    )
    // Clear possible parentId -attribute.
    const attributeMap: IKeyValueMap<string[]> = {
      ...(newFeatureLine.attributes as unknown as IKeyValueMap<string[]>),
    }
    if ('Parent' in attributeMap) {
      delete attributeMap.Parent
    }

    newFeatureLine.refSeq = selectedRefSeqId
    const locationMove = start - newFeatureLine.min
    newFeatureLine.min = start
    newFeatureLine.max = start + featureLength
    // Updates children start and end values
    const updatedChildren = updateRefSeqStartEnd(newFeatureLine, locationMove)

    const change = new AddFeatureChange({
      changedIds: [newFeatureLine._id],
      typeName: 'AddFeatureChange',
      assembly: selectedAssemblyId,
      addedFeature: {
        _id: newFeatureLine._id,
        refSeq: newFeatureLine.refSeq,
        min: newFeatureLine.min,
        max: newFeatureLine.max,
        type: newFeatureLine.type,
        children: updatedChildren.children as unknown as Record<
          string,
          AnnotationFeatureSnapshot
        >,
        attributes: attributeMap,
        strand: newFeatureLine.strand,
      },
      copyFeature: true,
      allIds: featureIds,
    })
    void changeManager.submit(change).then(() => {
      session.apolloSetSelectedFeature(newFeatureLine._id)
    })
    handleClose()
    event.preventDefault()
  }

  /**
   * Recursively loop children and update refSeq, start, and end values
   * @param feature - parent feature
   * @param locationMove - how much location has been moved from original
   * @returns
   */
  function updateRefSeqStartEnd(
    feature: AnnotationFeatureSnapshot,
    locationMove: number,
  ): AnnotationFeatureSnapshot {
    const children: Record<string, AnnotationFeatureSnapshot> = {}
    if (feature.children) {
      for (const child of Object.values(feature.children)) {
        const newChild = updateRefSeqStartEnd(child, locationMove)
        newChild.refSeq = selectedRefSeqId
        newChild.min = newChild.min + locationMove
        newChild.max = newChild.max + locationMove
        children[newChild._id] = newChild
      }
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

  return (
    <Dialog
      open
      title="Copy features and annotations"
      handleClose={handleClose}
      maxWidth={false}
      data-testid="copy-feature"
    >
      <form onSubmit={onSubmit}>
        <DialogContent style={{ display: 'flex', flexDirection: 'column' }}>
          <DialogContentText>Target assembly</DialogContentText>
          <Select
            labelId="label"
            value={selectedAssemblyId}
            onChange={handleChangeAssembly}
          >
            {assemblies
              .filter((option) => option.name !== sourceAssemblyId)
              .map((option) => (
                <MenuItem key={option.name} value={option.name}>
                  {readConfObject(option, 'displayName')}
                </MenuItem>
              ))}
          </Select>
          <DialogContentText>Target reference sequence</DialogContentText>
          <Select
            labelId="label"
            value={selectedRefSeqId}
            onChange={handleChangeRefSeq}
          >
            {refNames.map((option) => (
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
            type="number"
            fullWidth
            variant="outlined"
            value={start}
            onChange={(e) => {
              setStart(Number(e.target.value))
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button
            disabled={!selectedAssemblyId || !selectedRefSeqId || !start}
            variant="contained"
            type="submit"
          >
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
