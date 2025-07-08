/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-misused-promises */
import { type AnnotationFeature } from '@apollo-annotation/mst'
import {
  DeleteFeatureChange,
  LocationEndChange,
  LocationStartChange,
} from '@apollo-annotation/shared'
import { type AbstractSessionModel } from '@jbrowse/core/util'
import {
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
} from '@mui/material'
import { getSnapshot } from 'mobx-state-tree'
import React, { useState } from 'react'

import { type ChangeManager } from '../ChangeManager'
import { type ApolloSessionModel } from '../session'

import { Dialog } from './Dialog'
import { executionAsyncId } from 'node:async_hooks'
import { FeatureChange } from '@apollo-annotation/common'

interface DeleteFeatureProps {
  session: ApolloSessionModel
  handleClose(): void
  sourceFeature: AnnotationFeature
  sourceAssemblyId: string
  changeManager: ChangeManager
  selectedFeature?: AnnotationFeature
  setSelectedFeature(feature?: AnnotationFeature): void
}

export function DeleteFeature({
  changeManager,
  handleClose,
  selectedFeature,
  session,
  setSelectedFeature,
  sourceAssemblyId,
  sourceFeature,
}: DeleteFeatureProps) {
  const { notify } = session as unknown as AbstractSessionModel
  const [errorMessage, setErrorMessage] = useState('')
  const { ontologyManager } = session.apolloDataStore
  const { featureTypeOntology } = ontologyManager

  function isPartOfGene(sourceFeature: AnnotationFeature): boolean {
    if (!featureTypeOntology) {
      return false
    }
    if (
      featureTypeOntology.isTypeOf(sourceFeature.type, 'gene') ||
      featureTypeOntology.isTypeOf(sourceFeature.type, 'pseudogene') ||
      featureTypeOntology.isTypeOf(sourceFeature.type, 'transcript') ||
      featureTypeOntology.isTypeOf(sourceFeature.type, 'pseudogenic_transcript')
    ) {
      return true
    }
    if (!sourceFeature.parent) {
      return false
    }
    return isPartOfGene(sourceFeature.parent)
  }

  function resizeCDS(
    sourceFeature: AnnotationFeature,
  ): FeatureChange | undefined {
    if (!featureTypeOntology) {
      return
    }
    if (!featureTypeOntology.isTypeOf(sourceFeature.type, 'exon')) {
      return
    }
    if (
      !sourceFeature.parent?.cdsLocations ||
      sourceFeature.parent.cdsLocations.length === 0 ||
      sourceFeature.parent.cdsLocations[0].length === 0
    ) {
      // No CDS - parent of this exon is a non-coding transcript
      return
    }
    if (!sourceFeature.parent.children) {
      throw new Error('Unable to find parent of CDS')
    }
    if (sourceFeature.parent.cdsLocations.length != 1) {
      throw new Error('Unable to handle a transcript with multiple CDSs')
    }

    const _cdsLocations = sourceFeature.parent.cdsLocations.at(0) ?? []
    const cdsLocations = _cdsLocations.sort(({ min: a }, { min: b }) => a - b)
    let cdsFeature
    for (const child of sourceFeature.parent.children.values()) {
      if (child.type === cdsLocations[0].type) {
        cdsFeature = child
        break
      }
    }
    if (!cdsFeature) {
      throw new Error('Unable to find CDS')
    }
    const cdsStart = cdsLocations[0].min
    // eslint-disable-next-line unicorn/prefer-at
    const cdsEnd = cdsLocations[cdsLocations.length - 1].max
    if (
      (sourceFeature.min > cdsStart && sourceFeature.max < cdsEnd) ||
      sourceFeature.max < cdsStart ||
      sourceFeature.min > cdsEnd
    ) {
      // No adjustment if the exon being deleted is fully contained in the CDS
      // or completely outside of the CDS
      return
    }
    if (sourceFeature.min <= cdsStart && sourceFeature.max >= cdsEnd) {
      // CDS is fully contained in the exon, delete CDS
      return new DeleteFeatureChange({
        changedIds: [cdsFeature._id],
        typeName: 'DeleteFeatureChange',
        assembly: sourceAssemblyId,
        deletedFeature: getSnapshot(cdsFeature),
        parentFeatureId: cdsFeature.parent?._id,
      })
    }
    if (sourceFeature.min <= cdsStart && sourceFeature.max > cdsStart) {
      // Exon overlaps the start of the CDS so we need to move the CDS start
      let newCdsStart
      for (const cdsLocation of cdsLocations) {
        if (cdsLocation.min > sourceFeature.max) {
          newCdsStart = cdsLocation.min
          break
        }
      }
      if (!newCdsStart) {
        throw new Error('Error setting new CDS start')
      }
      return new LocationStartChange({
        typeName: 'LocationStartChange',
        changedIds: [cdsFeature._id],
        featureId: cdsFeature._id,
        oldStart: cdsFeature.min,
        newStart: newCdsStart,
        assembly: sourceAssemblyId,
      })
    }
    if (sourceFeature.min < cdsEnd && sourceFeature.max >= cdsEnd) {
      // Exon overlaps the end of the CDS so we need to move the CDS end
      let newCdsEnd
      for (const cdsLocation of cdsLocations.reverse()) {
        if (cdsLocation.max < sourceFeature.min) {
          newCdsEnd = cdsLocation.max
          break
        }
      }
      if (!newCdsEnd) {
        throw new Error('Error setting new CDS end')
      }
      return new LocationEndChange({
        typeName: 'LocationEndChange',
        changedIds: [cdsFeature._id],
        featureId: cdsFeature._id,
        oldEnd: cdsFeature.max,
        newEnd: newCdsEnd,
        assembly: sourceAssemblyId,
      })
    }
    throw new Error('Unexpected relationship between exon and CDS')
  }

  function resizeParent(
    featureToDelete: AnnotationFeature,
  ): FeatureChange | undefined {
    if (
      !featureToDelete.parent?.children ||
      featureToDelete.parent.children.size === 1
    ) {
      // Do not resize if this parent has only one child (i.e. the feature being deleted)
      return
    }
    const _children = []
    for (const x of featureToDelete.parent.children.values()) {
      _children.push(x)
    }
    const children = _children.sort((a, b) => a.min - b.min)
    if (featureToDelete._id === children[0]._id) {
      const newParentFeatureStart = children[1].min
      return new LocationStartChange({
        typeName: 'LocationStartChange',
        changedIds: [featureToDelete.parent._id],
        featureId: featureToDelete.parent._id,
        oldStart: featureToDelete.parent.min,
        newStart: newParentFeatureStart,
        assembly: sourceAssemblyId,
      })
    }
    if (
      // eslint-disable-next-line unicorn/prefer-at
      featureToDelete._id === children[children.length - 1]._id
    ) {
      // eslint-disable-next-line unicorn/prefer-at
      const newParentFeatureEnd = children[children.length - 2].max
      return new LocationEndChange({
        typeName: 'LocationEndChange',
        changedIds: [featureToDelete.parent._id],
        featureId: featureToDelete.parent._id,
        oldEnd: featureToDelete.parent.max,
        newEnd: newParentFeatureEnd,
        assembly: sourceAssemblyId,
      })
    }
    // The feature to be deleted is neither the first nor the last child so no need to resize the parent
    return
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    if (selectedFeature?._id === sourceFeature._id) {
      setSelectedFeature()
    }

    let resizeParentChange: FeatureChange | undefined
    if (isPartOfGene(sourceFeature)) {
      const cdsChange = resizeCDS(sourceFeature)
      if (cdsChange) {
        await changeManager.submit(cdsChange)
      }
      resizeParentChange = resizeParent(sourceFeature)
    }

    // Delete features
    const change = new DeleteFeatureChange({
      changedIds: [sourceFeature._id],
      typeName: 'DeleteFeatureChange',
      assembly: sourceAssemblyId,
      deletedFeature: getSnapshot(sourceFeature),
      parentFeatureId: sourceFeature.parent?._id,
    })
    await changeManager.submit(change)
    if (resizeParentChange) {
      await changeManager.submit(resizeParentChange)
    }
    notify('Feature deleted successfully', 'success')
    handleClose()
    event.preventDefault()
  }

  return (
    <Dialog
      open
      title="Delete feature"
      handleClose={handleClose}
      maxWidth={false}
      data-testid="delete-feature"
    >
      <form onSubmit={onSubmit}>
        <DialogContent style={{ display: 'flex', flexDirection: 'column' }}>
          <DialogContentText>
            Are you sure you want to delete the selected feature?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" type="submit">
            Yes
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
