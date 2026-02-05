/* eslint-disable @typescript-eslint/unbound-method */

import { type AnnotationFeature } from '@apollo-annotation/mst'
import {
  DeleteFeatureChange,
  LocationEndChange,
  LocationStartChange,
} from '@apollo-annotation/shared'
import { getSnapshot } from '@jbrowse/mobx-state-tree'
import {
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
} from '@mui/material'
import React, { useState } from 'react'

import { type ChangeManager } from '../ChangeManager'
import { type ApolloSessionModel } from '../session'

import { Dialog } from './Dialog'

interface LocationChange {
  typeName: 'LocationStartChange' | 'LocationEndChange'
  changedId: string
  featureId: string
  oldLocation: number
  newLocation: number
}

interface DeleteFeatureProps {
  session: ApolloSessionModel
  handleClose(): void
  sourceFeature: AnnotationFeature
  sourceAssemblyId: string
  changeManager: ChangeManager
  selectedFeature?: AnnotationFeature
  setSelectedFeature(feature?: AnnotationFeature): void
}

function lumpLocationChanges(
  changes: LocationChange[],
  assembly: string,
): LocationStartChange | LocationEndChange | undefined {
  if (changes.length === 0) {
    return
  }
  const locationStartChange = new LocationStartChange({
    typeName: 'LocationStartChange',
    changedIds: [],
    changes: [],
    assembly,
  })
  const locationEndChange = new LocationEndChange({
    typeName: 'LocationEndChange',
    changedIds: [],
    changes: [],
    assembly,
  })
  for (const change of changes) {
    if (change.typeName === 'LocationStartChange') {
      locationStartChange.changedIds.push(change.changedId)
      const cc = {
        featureId: change.featureId,
        oldStart: change.oldLocation,
        newStart: change.newLocation,
      }
      locationStartChange.changes.push(cc)
    }
    if (change.typeName === 'LocationEndChange') {
      locationEndChange.changedIds.push(change.changedId)
      const cc = {
        featureId: change.featureId,
        oldEnd: change.oldLocation,
        newEnd: change.newLocation,
      }
      locationEndChange.changes.push(cc)
    }
  }
  if (
    locationStartChange.changedIds.length > 0 &&
    locationEndChange.changedIds.length === 0
  ) {
    return locationStartChange
  }
  if (
    locationEndChange.changedIds.length > 0 &&
    locationStartChange.changedIds.length === 0
  ) {
    return locationEndChange
  }
  throw new Error('Unexpected list of changes')
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
  const [errorMessage, setErrorMessage] = useState('')
  const { ontologyManager } = session.apolloDataStore
  const { featureTypeOntology } = ontologyManager

  function trimCDS(
    sourceFeature: AnnotationFeature,
  ): DeleteFeatureChange | LocationChange | undefined {
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
        changes: [
          {
            deletedFeature: getSnapshot(cdsFeature),
            parentFeatureId: cdsFeature.parent?._id,
          },
        ],
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
      return {
        typeName: 'LocationStartChange',
        changedId: cdsFeature._id,
        featureId: cdsFeature._id,
        oldLocation: cdsFeature.min,
        newLocation: newCdsStart,
      }
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
      return {
        typeName: 'LocationEndChange',
        changedId: cdsFeature._id,
        featureId: cdsFeature._id,
        oldLocation: cdsFeature.max,
        newLocation: newCdsEnd,
      }
    }
    throw new Error('Unexpected relationship between exon and CDS')
  }

  function trimParent(
    featureToDelete: AnnotationFeature,
  ): LocationChange | undefined {
    if (
      !featureToDelete.parent?.children ||
      featureToDelete.parent.children.size === 1
    ) {
      // Do not resize if this parent has only one child (i.e. the feature being deleted)
      return
    }
    const childrenByStart = []
    for (const x of featureToDelete.parent.children.values()) {
      if (!featureTypeOntology?.isTypeOf(x.type, 'CDS')) {
        // CDS has been already handled so don't use it to resize parent
        childrenByStart.push(x)
      }
    }
    childrenByStart.sort((a, b) => a.min - b.min)

    const childrenByEnd = []
    for (const x of featureToDelete.parent.children.values()) {
      if (!featureTypeOntology?.isTypeOf(x.type, 'CDS')) {
        // CDS has been already handled so don't use it to resize parent
        childrenByEnd.push(x)
      }
    }
    childrenByEnd.sort((a, b) => b.max - a.max)

    if (featureToDelete.min === childrenByStart[0].min) {
      // The feature to delete has the lowest start coordinate of all children
      // Find the next lowest coordinate and reset parent to this new start
      let newParentFeatureStart
      for (const child of childrenByStart) {
        if (
          child._id !== featureToDelete._id &&
          child.min >= featureToDelete.min
        ) {
          newParentFeatureStart = child.min
          break
        }
      }
      if (
        newParentFeatureStart &&
        newParentFeatureStart != featureToDelete.parent.min
      ) {
        return {
          typeName: 'LocationStartChange',
          changedId: featureToDelete.parent._id,
          featureId: featureToDelete.parent._id,
          oldLocation: featureToDelete.parent.min,
          newLocation: newParentFeatureStart,
        }
      }
    }

    if (featureToDelete.max === childrenByEnd[0].max) {
      // The feature to delete has the highest end coordinate of all children
      // Find the next highest coordinate and reset parent to this new end
      let newParentFeatureEnd
      for (const child of childrenByEnd) {
        if (
          child._id != featureToDelete._id &&
          child.max <= featureToDelete.max
        ) {
          newParentFeatureEnd = child.max
          break
        }
      }
      if (
        newParentFeatureEnd &&
        newParentFeatureEnd != featureToDelete.parent.max
      ) {
        return {
          typeName: 'LocationEndChange',
          changedId: featureToDelete.parent._id,
          featureId: featureToDelete.parent._id,
          oldLocation: featureToDelete.parent.max,
          newLocation: newParentFeatureEnd,
        }
      }
    }
    return
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    if (selectedFeature?._id === sourceFeature._id) {
      setSelectedFeature()
    }

    const locationChanges: LocationChange[] = []
    // const deleteChanges: DeleteFeatureChange = []

    const deleteChanges = new DeleteFeatureChange({
      changedIds: [sourceFeature._id],
      typeName: 'DeleteFeatureChange',
      assembly: sourceAssemblyId,
      changes: [
        {
          deletedFeature: getSnapshot(sourceFeature),
          parentFeatureId: sourceFeature.parent?._id,
        },
      ],
    })

    if (
      featureTypeOntology &&
      (featureTypeOntology.isTypeOf(sourceFeature.type, 'transcript') ||
        featureTypeOntology.isTypeOf(
          sourceFeature.type,
          'pseudogenic_transcript',
        ))
    ) {
      const geneChange = trimParent(sourceFeature)
      if (geneChange) {
        locationChanges.push(geneChange)
      }
    }

    if (
      featureTypeOntology &&
      featureTypeOntology.isTypeOf(sourceFeature.type, 'exon')
    ) {
      const cdsChange = trimCDS(sourceFeature)
      if (cdsChange) {
        if (cdsChange.typeName === 'DeleteFeatureChange') {
          deleteChanges.changedIds.push(...cdsChange.changedIds)
          deleteChanges.changes.push(...cdsChange.changes)
        } else {
          locationChanges.push(cdsChange)
        }
      }

      const txChange = trimParent(sourceFeature)
      if (txChange) {
        locationChanges.push(txChange)
        // Parent transcript has changed. See if we need to resize the parent gene
        const gene = sourceFeature.parent?.parent
        if (gene?.children) {
          if (txChange.typeName === 'LocationStartChange') {
            let newGeneStart = txChange.newLocation
            for (const [, tx] of gene.children) {
              if (tx._id != txChange.featureId && tx.min < newGeneStart) {
                // Reset to longest child (tx)
                newGeneStart = tx.min
              }
            }
            if (newGeneStart != gene.min) {
              locationChanges.push({
                typeName: txChange.typeName,
                changedId: gene._id,
                featureId: gene._id,
                oldLocation: gene.min,
                newLocation: newGeneStart,
              })
            }
          } else {
            let newGeneEnd = txChange.newLocation
            for (const [, tx] of gene.children) {
              if (tx._id != txChange.featureId && tx.max > newGeneEnd) {
                // Reset to longest child (tx)
                newGeneEnd = tx.max
              }
            }
            if (newGeneEnd != gene.max) {
              locationChanges.push({
                typeName: txChange.typeName,
                changedId: gene._id,
                featureId: gene._id,
                oldLocation: gene.max,
                newLocation: newGeneEnd,
              })
            }
          }
        }
      }
    }

    const lumpedLocChanges = lumpLocationChanges(
      locationChanges,
      sourceAssemblyId,
    )

    await changeManager.submit(deleteChanges)
    if (lumpedLocChanges) {
      await changeManager.submit(lumpedLocChanges)
    }

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
      <form
        onSubmit={(event) => {
          void onSubmit(event)
        }}
      >
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
