/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable unicorn/no-useless-undefined */
/* eslint-disable @typescript-eslint/no-misused-promises */
import React, { useEffect, useMemo, useState } from 'react'

import {
  Box,
  Button,
  Checkbox,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  Typography,
} from '@mui/material'

import { Dialog } from './Dialog'
import { ApolloSessionModel } from '../session'
import { AnnotationFeatureSnapshot } from '@apollo-annotation/mst'
import { getSnapshot } from 'mobx-state-tree'
import { AddFeatureChange } from '@apollo-annotation/shared'
import { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import { AbstractSessionModel } from '@jbrowse/core/util'

interface CreateApolloAnnotationProps {
  session: AbstractSessionModel
  handleClose(): void
  annotationFeature: AnnotationFeatureSnapshot
  assembly: Assembly
  refSeqId: string
}

// TODO: Integrate SO
const isGeneOrTranscript = (annotationFeature: AnnotationFeatureSnapshot) => {
  return (
    annotationFeature.type === 'gene' ||
    annotationFeature.type === 'mRNA' ||
    annotationFeature.type === 'transcript'
  )
}

// TODO: Integrate SO
const isTranscript = (annotationFeature: AnnotationFeatureSnapshot) => {
  return (
    annotationFeature.type === 'mRNA' || annotationFeature.type === 'transcript'
  )
}

export function CreateApolloAnnotation({
  annotationFeature,
  assembly,
  handleClose,
  refSeqId,
  session,
}: CreateApolloAnnotationProps) {
  const apolloSessionModel = session as unknown as ApolloSessionModel
  const childIds = useMemo(
    () => Object.keys(annotationFeature.children ?? {}),
    [annotationFeature],
  )

  const features = useMemo(() => {
    for (const [, asm] of apolloSessionModel.apolloDataStore.assemblies) {
      if (asm._id === assembly.name) {
        for (const [, refSeq] of asm.refSeqs) {
          if (refSeq._id === refSeqId) {
            return refSeq.features
          }
        }
      }
    }
    return []
  }, [])

  const [parentFeatureChecked, setParentFeatureChecked] = useState(true)
  const [checkedChildrens, setCheckedChildrens] = useState<string[]>(childIds)
  const [errorMessage, setErrorMessage] = useState('')
  const [destinationFeatures, setDestinationFeatures] = useState<
    AnnotationFeatureSnapshot[]
  >([])
  const [selectedDestinationFeature, setSelectedDestinationFeature] =
    useState<AnnotationFeatureSnapshot>()

  const getFeatures = (min: number, max: number) => {
    const filteredFeatures: AnnotationFeatureSnapshot[] = []

    for (const [, f] of features) {
      const featureSnapshot = getSnapshot(f)
      if (min >= featureSnapshot.min && max <= featureSnapshot.max) {
        filteredFeatures.push(featureSnapshot)
      }
    }

    return filteredFeatures
  }

  useEffect(() => {
    setErrorMessage('')
    if (checkedChildrens.length === 0) {
      setParentFeatureChecked(false)
      return
    }

    if (annotationFeature.children) {
      const checkedAnnotationFeatureChildren = Object.values(
        annotationFeature.children,
      )
        .filter((child) => isTranscript(child))
        .filter((child) => checkedChildrens.includes(child._id))
      const mins = checkedAnnotationFeatureChildren.map((f) => f.min)
      const maxes = checkedAnnotationFeatureChildren.map((f) => f.max)
      const min = Math.min(...mins)
      const max = Math.max(...maxes)
      const filteredFeatures = getFeatures(min, max)
      setDestinationFeatures(filteredFeatures)

      if (
        filteredFeatures.length === 0 &&
        checkedChildrens.length > 0 &&
        !parentFeatureChecked
      ) {
        setErrorMessage('No destination features found')
      }
    }
  }, [checkedChildrens])

  const handleParentFeatureCheck = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const isChecked = event.target.checked
    setParentFeatureChecked(isChecked)
    setCheckedChildrens(isChecked ? childIds : [])
  }

  const handleChildFeatureCheck = (
    event: React.ChangeEvent<HTMLInputElement>,
    child: AnnotationFeatureSnapshot,
  ) => {
    setCheckedChildrens((prevChecked) =>
      event.target.checked
        ? [...prevChecked, child._id]
        : prevChecked.filter((childId) => childId !== child._id),
    )
  }

  const handleDestinationFeatureChange = (e: SelectChangeEvent) => {
    const selectedFeature = destinationFeatures.find(
      (f) => f._id === e.target.value,
    )
    setSelectedDestinationFeature(selectedFeature)
  }

  const handleCreateApolloAnnotation = async () => {
    if (parentFeatureChecked) {
      const change = new AddFeatureChange({
        changedIds: [annotationFeature._id],
        typeName: 'AddFeatureChange',
        assembly: assembly.name,
        addedFeature: annotationFeature,
      })
      await apolloSessionModel.apolloDataStore.changeManager.submit(change)
      session.notify('Annotation added successfully', 'success')
      handleClose()
    } else {
      if (!annotationFeature.children) {
        return
      }
      if (!selectedDestinationFeature) {
        return
      }

      for (const childId of checkedChildrens) {
        const child = annotationFeature.children[childId]
        const change = new AddFeatureChange({
          parentFeatureId: selectedDestinationFeature._id,
          changedIds: [selectedDestinationFeature._id],
          typeName: 'AddFeatureChange',
          assembly: assembly.name,
          addedFeature: child,
        })
        await apolloSessionModel.apolloDataStore.changeManager.submit(change)
        session.notify('Annotation added successfully', 'success')
        handleClose()
      }
    }
  }

  return (
    <Dialog
      open
      title="Create Apollo Annotation"
      handleClose={handleClose}
      fullWidth={true}
      maxWidth="sm"
    >
      <DialogTitle fontSize={15}>
        Select the feature to be copied to apollo track
      </DialogTitle>
      <DialogContent>
        <Box sx={{ ml: 3 }}>
          {isGeneOrTranscript(annotationFeature) && (
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={parentFeatureChecked}
                  onChange={handleParentFeatureCheck}
                />
              }
              label={`${annotationFeature.type}:${annotationFeature.min}..${annotationFeature.max}`}
            />
          )}
          {annotationFeature.children && (
            <Box sx={{ display: 'flex', flexDirection: 'column', ml: 3 }}>
              {Object.values(annotationFeature.children)
                .filter((child) => isTranscript(child))
                .map((child) => (
                  <FormControlLabel
                    key={child._id}
                    control={
                      <Checkbox
                        size="small"
                        checked={checkedChildrens.includes(child._id)}
                        onChange={(e) => {
                          handleChildFeatureCheck(e, child)
                        }}
                      />
                    }
                    label={`${child.type}:${child.min}..${child.max}`}
                  />
                ))}
            </Box>
          )}
        </Box>
        {!parentFeatureChecked &&
          checkedChildrens.length > 0 &&
          destinationFeatures.length > 0 && (
            <Box sx={{ ml: 3 }}>
              <Typography variant="caption" fontSize={12}>
                Select the destination feature to copy the selected features
              </Typography>

              <Box sx={{ mt: 1 }}>
                <Select
                  labelId="label"
                  style={{ width: '100%' }}
                  value={selectedDestinationFeature?._id ?? ''}
                  onChange={handleDestinationFeatureChange}
                >
                  {destinationFeatures.map((f) => (
                    <MenuItem key={f._id} value={f._id}>
                      {`${f.type}:${f.min}..${f.max}`}
                    </MenuItem>
                  ))}
                </Select>
              </Box>
            </Box>
          )}
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          type="submit"
          disabled={
            checkedChildrens.length === 0 ||
            (!parentFeatureChecked &&
              checkedChildrens.length > 0 &&
              !selectedDestinationFeature)
          }
          onClick={handleCreateApolloAnnotation}
        >
          Create
        </Button>
        <Button variant="outlined" type="submit" onClick={handleClose}>
          Cancel
        </Button>
      </DialogActions>
      {errorMessage ? (
        <DialogContent>
          <DialogContentText color="error">{errorMessage}</DialogContentText>
        </DialogContent>
      ) : null}
    </Dialog>
  )
}
