/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable @typescript-eslint/unbound-method */

import { type AnnotationFeatureSnapshot } from '@apollo-annotation/mst'
import { AddFeatureChange } from '@apollo-annotation/shared'
import { type Assembly } from '@jbrowse/core/assemblyManager/assembly'
import { type AbstractSessionModel } from '@jbrowse/core/util'
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
  type SelectChangeEvent,
  Typography,
} from '@mui/material'
import { getSnapshot } from 'mobx-state-tree'
import React, { useEffect, useMemo, useState } from 'react'

import { type ApolloSessionModel } from '../session'

import { Dialog } from './Dialog'

interface CreateApolloAnnotationProps {
  session: AbstractSessionModel
  handleClose(): void
  annotationFeature: AnnotationFeatureSnapshot
  assembly: Assembly
  refSeqId: string
}

const isGeneOrTranscript = (
  annotationFeature: AnnotationFeatureSnapshot,
  apolloSessionModel: ApolloSessionModel,
) => {
  const { featureTypeOntology } =
    apolloSessionModel.apolloDataStore.ontologyManager
  if (!featureTypeOntology) {
    throw new Error('featureTypeOntology is undefined')
  }
  return (
    featureTypeOntology.isTypeOf(annotationFeature.type, 'gene') ||
    featureTypeOntology.isTypeOf(annotationFeature.type, 'transcript') ||
    featureTypeOntology.isTypeOf(annotationFeature.type, 'pseudogene') ||
    featureTypeOntology.isTypeOf(
      annotationFeature.type,
      'pseudogenic_transcript',
    )
  )
}

const isGene = (
  annotationFeature: AnnotationFeatureSnapshot,
  apolloSessionModel: ApolloSessionModel,
) => {
  const { featureTypeOntology } =
    apolloSessionModel.apolloDataStore.ontologyManager
  if (!featureTypeOntology) {
    throw new Error('featureTypeOntology is undefined')
  }
  return (
    featureTypeOntology.isTypeOf(annotationFeature.type, 'gene') ||
    featureTypeOntology.isTypeOf(annotationFeature.type, 'pseudogene')
  )
}

const isTranscript = (
  annotationFeature: AnnotationFeatureSnapshot,
  apolloSessionModel: ApolloSessionModel,
) => {
  const { featureTypeOntology } =
    apolloSessionModel.apolloDataStore.ontologyManager
  if (!featureTypeOntology) {
    throw new Error('featureTypeOntology is undefined')
  }
  return (
    featureTypeOntology.isTypeOf(annotationFeature.type, 'transcript') ||
    featureTypeOntology.isTypeOf(
      annotationFeature.type,
      'pseudogenic_transcript',
    )
  )
}

const getFeatureId = (feature: AnnotationFeatureSnapshot) => {
  const { attributes } = feature
  const id = attributes?.id
  if (id) {
    return id[0]
  }
  return feature.type
}

const getFeatureNameOrId = (
  feature: AnnotationFeatureSnapshot,
  apolloSessionModel: ApolloSessionModel,
) => {
  const { featureTypeOntology } =
    apolloSessionModel.apolloDataStore.ontologyManager
  if (!featureTypeOntology) {
    return getFeatureId(feature)
  }

  let attrName = ''

  if (featureTypeOntology.isTypeOf(feature.type, 'gene')) {
    attrName = 'gene_name'
  }

  if (featureTypeOntology.isTypeOf(feature.type, 'transcript')) {
    attrName = 'transcript_name'
  }

  const { attributes } = feature
  const name = attributes?.[attrName]
  if (name) {
    return name[0]
  }
  return getFeatureId(feature)
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
      if (f.type === 'chromosome') {
        continue
      }
      const featureSnapshot = getSnapshot(f)
      if (min >= featureSnapshot.min && max <= featureSnapshot.max) {
        filteredFeatures.push(featureSnapshot)
      }
    }

    return filteredFeatures
  }

  useEffect(() => {
    setErrorMessage('')
    let mins: number[] = []
    let maxes: number[] = []
    if (annotationFeature.children) {
      const checkedAnnotationFeatureChildren = Object.values(
        annotationFeature.children,
      )
        .filter((child) => isTranscript(child, apolloSessionModel))
        .filter((child) => checkedChildrens.includes(child._id))
      mins = checkedAnnotationFeatureChildren.map((f) => f.min)
      maxes = checkedAnnotationFeatureChildren.map((f) => f.max)
    }

    const { featureTypeOntology } =
      apolloSessionModel.apolloDataStore.ontologyManager
    if (
      featureTypeOntology &&
      featureTypeOntology.isTypeOf(annotationFeature.type, 'transcript')
    ) {
      mins = [annotationFeature.min, ...mins]
      maxes = [annotationFeature.max, ...maxes]
    }

    const min = Math.min(...mins)
    const max = Math.max(...maxes)
    const filteredFeatures = getFeatures(min, max)
    setDestinationFeatures(filteredFeatures)
    setSelectedDestinationFeature(filteredFeatures[0])
  }, [checkedChildrens, parentFeatureChecked])

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
      let change
      if (isGene(annotationFeature, apolloSessionModel)) {
        if (
          annotationFeature.children &&
          checkedChildrens.length !==
            Object.values(annotationFeature.children).length
        ) {
          const childrens: Record<string, AnnotationFeatureSnapshot> = {}
          for (const childId of checkedChildrens) {
            childrens[childId] = annotationFeature.children[childId]
          }
          change = new AddFeatureChange({
            changedIds: [annotationFeature._id],
            typeName: 'AddFeatureChange',
            assembly: assembly.name,
            addedFeature: {
              ...annotationFeature,
              children: childrens,
            },
          })
        } else {
          change = new AddFeatureChange({
            changedIds: [annotationFeature._id],
            typeName: 'AddFeatureChange',
            assembly: assembly.name,
            addedFeature: annotationFeature,
          })
        }
      }

      if (isTranscript(annotationFeature, apolloSessionModel)) {
        if (selectedDestinationFeature) {
          change = new AddFeatureChange({
            parentFeatureId: selectedDestinationFeature._id,
            changedIds: [selectedDestinationFeature._id],
            typeName: 'AddFeatureChange',
            assembly: assembly.name,
            addedFeature: annotationFeature,
          })
        } else {
          setErrorMessage('There is no destination gene for this transcript')
          return
        }
      }

      if (!change) {
        return
      }

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
      }
      session.notify('Annotation added successfully', 'success')
      handleClose()
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
          {isGeneOrTranscript(annotationFeature, apolloSessionModel) && (
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={parentFeatureChecked}
                  onChange={handleParentFeatureCheck}
                />
              }
              label={`${getFeatureNameOrId(annotationFeature, apolloSessionModel)} (${annotationFeature.min + 1}..${annotationFeature.max})`}
            />
          )}
          {annotationFeature.children && (
            <Box sx={{ display: 'flex', flexDirection: 'column', ml: 3 }}>
              {Object.values(annotationFeature.children)
                .filter((child) => isTranscript(child, apolloSessionModel))
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
                    label={`${getFeatureNameOrId(child, apolloSessionModel)} (${child.min + 1}..${child.max})`}
                  />
                ))}
            </Box>
          )}
        </Box>
        {destinationFeatures.length > 0 &&
          ((!parentFeatureChecked && checkedChildrens.length > 0) ||
            (parentFeatureChecked &&
              isTranscript(annotationFeature, apolloSessionModel))) && (
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
                      {`${getFeatureNameOrId(f, apolloSessionModel)} (${f.min}..${f.max})`}
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
