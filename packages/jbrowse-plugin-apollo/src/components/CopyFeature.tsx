import { readConfObject } from '@jbrowse/core/configuration'
import { AbstractSessionModel } from '@jbrowse/core/util'
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
import { AddFeatureChange } from 'apollo-shared'
import ObjectID from 'bson-objectid'
import { IKeyValueMap } from 'mobx'
import { getSnapshot } from 'mobx-state-tree'
import React, { useEffect, useState } from 'react'

import { ChangeManager } from '../ChangeManager'

interface CopyFeatureProps {
  session: AbstractSessionModel
  handleClose(): void
  sourceFeature: AnnotationFeatureI
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
  const { assemblyManager } = session
  const assemblies = assemblyManager.assemblyList

  const [selectedAssemblyId, setSelectedAssemblyId] =
    useState<string>(
      assemblies.find((a) => a.name !== sourceAssemblyId)?.name,
    ) || ''
  const [refNames, setRefNames] = useState<Collection[]>([])
  const [selectedRefSeqId, setSelectedRefSeqId] = useState('')
  const [start, setStart] = useState(sourceFeature.start)
  const [errorMessage, setErrorMessage] = useState('')
  const { notify } = session

  async function handleChangeAssembly(e: SelectChangeEvent<string>) {
    setSelectedAssemblyId(e.target.value)
  }

  useEffect(() => {
    setSelectedRefSeqId('')
    async function getRefNames() {
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
        .map(([id, refName]) => ({ _id: id, name: refName ?? '' }))
      setRefNames(newRefNames)
      setSelectedRefSeqId(newRefNames[0]?._id || '')
    }
    getRefNames().catch((error) => setErrorMessage(String(error)))
  }, [selectedAssemblyId, assemblyManager])

  async function handleChangeRefSeq(e: SelectChangeEvent<string>) {
    const refSeq = e.target.value as string
    setSelectedRefSeqId(refSeq)
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    const featureLength = sourceFeature.length
    const assembly = await assemblyManager.waitForAssembly(selectedAssemblyId)
    if (!assembly) {
      setErrorMessage(`Assembly not found: ${selectedAssemblyId}.`)
      return
    }
    const canonicalRefName = assembly?.getCanonicalRefName(selectedRefSeqId)
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

    // Update gffId value if it's ObjectId
    if (
      newFeatureLine.gffId &&
      ObjectID.isValid(newFeatureLine.gffId.toString())
    ) {
      newFeatureLine.gffId = newFeatureLine._id
    }
    newFeatureLine.refSeq = selectedRefSeqId
    const locationMove = start - newFeatureLine.start
    newFeatureLine.start = start
    newFeatureLine.end = start + featureLength
    // Updates children start, end and gffId values
    const updatedChildren = updateRefSeqStartEndAndGffId(
      newFeatureLine,
      locationMove,
    )

    const change = new AddFeatureChange({
      changedIds: [newFeatureLine._id],
      typeName: 'AddFeatureChange',
      assembly: selectedAssemblyId,
      addedFeature: {
        _id: newFeatureLine._id,
        refSeq: newFeatureLine.refSeq,
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
    await changeManager.submit?.(change)

    notify('Feature copied successfully', 'success')
    handleClose()
    event.preventDefault()
  }

  /**
   * Recursively loop children and update refSeq, start, end and gffId values
   * @param feature - parent feature
   * @param locationMove - how much location has been moved from original
   * @returns
   */
  function updateRefSeqStartEndAndGffId(
    feature: AnnotationFeatureSnapshot,
    locationMove: number,
  ): AnnotationFeatureSnapshot {
    const children: Record<string, AnnotationFeatureSnapshot> = {}
    if (feature.children) {
      for (const child of Object.values(feature.children)) {
        const newChild = updateRefSeqStartEndAndGffId(child, locationMove)
        // Update gffId value if it's ObjectId
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        if (ObjectID.isValid(newChild.gffId!.toString())) {
          newChild.gffId = newChild._id
        }
        newChild.refSeq = selectedRefSeqId
        newChild.start = newChild.start + locationMove
        newChild.end = newChild.end + locationMove
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
    <Dialog open maxWidth="xl" data-testid="login-apollo">
      <DialogTitle>Copy features and annotations</DialogTitle>
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
