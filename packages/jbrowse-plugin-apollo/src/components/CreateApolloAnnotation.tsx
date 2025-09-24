/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable @typescript-eslint/unbound-method */

import { type AnnotationFeatureSnapshot } from '@apollo-annotation/mst'
import {
  AddFeatureChange,
  LocationEndChange,
  LocationStartChange,
} from '@apollo-annotation/shared'
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
  FormGroup,
  MenuItem,
  Select,
  type SelectChangeEvent,
  Typography,
} from '@mui/material'
import ObjectID from 'bson-objectid'
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
  region: {
    start: number
    end: number
  }
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

export function getFeatureName(feature: AnnotationFeatureSnapshot) {
  const { attributes } = feature
  const keys = ['name', 'gff_name', 'transcript_name', 'gene_name']
  for (const key of keys) {
    const value = attributes?.[key]
    if (value?.[0]) {
      return value[0]
    }
  }
  return ''
}

export function getGeneNameOrId(feature: AnnotationFeatureSnapshot) {
  const { attributes } = feature
  const keys = ['gene_name', 'gene_id', 'gene_stable_id']
  for (const key of keys) {
    const value = attributes?.[key]
    if (value?.[0]) {
      return value[0]
    }
  }
  return ''
}

export function getFeatureId(feature: AnnotationFeatureSnapshot) {
  const { attributes } = feature
  const keys = [
    'id',
    'gff_id',
    'transcript_id',
    'gene_id',
    'gene_stable_id',
    'stable_id',
  ]
  for (const key of keys) {
    const value = attributes?.[key]
    if (value?.[0]) {
      return value[0]
    }
  }
  return ''
}

const getFeatureNameOrId = (feature: AnnotationFeatureSnapshot) => {
  const name = getFeatureName(feature)
  const id = getFeatureId(feature)
  if (name) {
    return `${feature.type} - ${name}`
  }
  if (id) {
    return `${feature.type} - ${id}`
  }
  return feature.type
}

export function CreateApolloAnnotation({
  annotationFeature,
  assembly,
  handleClose,
  refSeqId,
  session,
  region,
}: CreateApolloAnnotationProps) {
  const apolloSessionModel = session as unknown as ApolloSessionModel
  const { featureTypeOntology } =
    apolloSessionModel.apolloDataStore.ontologyManager
  const childIds = useMemo(
    () => Object.keys(annotationFeature.children ?? {}),
    [annotationFeature],
  )

  const [parentFeatureChecked, setParentFeatureChecked] = useState(true)
  const [checkedChildrens, setCheckedChildrens] = useState<string[]>(childIds)
  const [errorMessage, setErrorMessage] = useState('')
  const [destinationFeatures, setDestinationFeatures] = useState<
    AnnotationFeatureSnapshot[]
  >([])
  const [createNewGene, setCreateNewGene] = useState(false)
  const [selectedDestinationFeature, setSelectedDestinationFeature] =
    useState<AnnotationFeatureSnapshot>()

  const apolloAssembly = apolloSessionModel.apolloDataStore.assemblies.get(
    assembly.name,
  )
  const refSeq = apolloAssembly?.refSeqs.get(refSeqId)
  const features = refSeq?.getFeatures(region.start, region.end)

  const getDestinationFeatures = () => {
    const filteredFeatures: AnnotationFeatureSnapshot[] = []

    for (const f of features ?? []) {
      if (f.min > region.end || f.max < region.start) {
        continue
      }

      // Destination feature should be of type gene
      if (featureTypeOntology?.isTypeOf(f.type, 'gene')) {
        const featureSnapshot = getSnapshot(f)
        filteredFeatures.push(featureSnapshot)
      }
    }

    return filteredFeatures
  }

  useEffect(() => {
    setErrorMessage('')
    const features = getDestinationFeatures()
    setDestinationFeatures(features)
    setSelectedDestinationFeature(features[0])
  }, [checkedChildrens, parentFeatureChecked, region])

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
      // IF SOURCE FEATURE IS GENE
      if (isGene(annotationFeature, apolloSessionModel)) {
        await copyGeneFeature()
        session.notify(
          'Successfully copied selected gene and transcript(s)',
          'success',
        )
      }
      if (isTranscript(annotationFeature, apolloSessionModel)) {
        // IF THE SOURCE IS TRANSCRIPT AND THE DESTINATION IS SELECTED AND CREATE NEW GENE IS NOT CHECKED
        if (selectedDestinationFeature && !createNewGene) {
          const transcripts: Record<string, AnnotationFeatureSnapshot> = {}
          transcripts[annotationFeature._id] = annotationFeature

          // If source trancript doesn't overlap with destination gene
          // If not overlapping, then extend the destination gene to include the transcript
          if (
            selectedDestinationFeature.max < annotationFeature.max ||
            selectedDestinationFeature.min > annotationFeature.min
          ) {
            const newMin = Math.min(
              selectedDestinationFeature.min,
              annotationFeature.min,
            )
            const newMax = Math.max(
              selectedDestinationFeature.max,
              annotationFeature.max,
            )
            await extendSelectedDestinationFeatureLocation(newMin, newMax)
            await copyTranscriptsToDestinationGene(transcripts)
          } else {
            await copyTranscriptsToDestinationGene(transcripts)
          }
          session.notify(
            'Successfully copied selected transcripts to destination gene',
            'success',
          )
        } else {
          // IF THERE IS NO DESTINATION GENE SELECTED AND CREATE NEW GENE IS CHECKED
          const childrens: Record<string, AnnotationFeatureSnapshot> = {}
          childrens[annotationFeature._id] = annotationFeature
          await createNewGeneFeatureWithTranscripts(childrens)
          session.notify(
            'Successfully created a new gene with selected transcripts',
            'success',
          )
        }
      }
    } else {
      // IF PARENT (GENE) FEATURE IS NOT CHECKED AND WE ARE COPYING CHILDREN (TRANSCRIPTS)
      if (!annotationFeature.children) {
        return
      }

      // IF DESTINATION IS SELECTED AND CREATE NEW GENE IS NOT CHECKED
      if (selectedDestinationFeature && !createNewGene) {
        const childrens: Record<string, AnnotationFeatureSnapshot> = {}
        for (const childId of checkedChildrens) {
          childrens[childId] = annotationFeature.children[childId]
        }
        const min = Math.min(
          ...Object.values(childrens).map((child) => child.min),
        )
        const max = Math.max(
          ...Object.values(childrens).map((child) => child.max),
        )

        // If source trancript doesn't overlap with destination gene
        // If not overlapping, then extend the destination gene to include the transcript
        if (
          selectedDestinationFeature.min > min ||
          selectedDestinationFeature.max < max
        ) {
          const newMin = Math.min(selectedDestinationFeature.min, min)
          const newMax = Math.max(selectedDestinationFeature.max, max)
          await extendSelectedDestinationFeatureLocation(newMin, newMax)
          await copyTranscriptsToDestinationGene(childrens)
        } else {
          await copyTranscriptsToDestinationGene(childrens)
        }
        session.notify(
          'Successfully copied transcript to destination gene',
          'success',
        )
      } else {
        // IF THERE IS NO DESTINATION GENE SELECTED AND CREATE NEW GENE IS CHECKED
        const childrens: Record<string, AnnotationFeatureSnapshot> = {}
        for (const childId of checkedChildrens) {
          childrens[childId] = annotationFeature.children[childId]
        }
        await createNewGeneFeatureWithTranscripts(childrens)
        session.notify(
          'Successfully created a new gene with selected transcript',
          'success',
        )
      }
    }
    handleClose()
  }

  // Copies gene feature along with its selected children
  const copyGeneFeature = async () => {
    let change
    if (
      annotationFeature.children &&
      checkedChildrens.length !==
        Object.values(annotationFeature.children).length
    ) {
      // IF SOME CHILDREN ARE CHECKED
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
      // IF PARENT AND ALL CHILDREN ARE CHECKED
      change = new AddFeatureChange({
        changedIds: [annotationFeature._id],
        typeName: 'AddFeatureChange',
        assembly: assembly.name,
        addedFeature: annotationFeature,
      })
    }

    await submitChange(change)
  }

  const copyTranscriptsToDestinationGene = async (
    transcripts: Record<string, AnnotationFeatureSnapshot>,
  ) => {
    if (!selectedDestinationFeature) {
      return
    }
    for (const transcriptId of Object.keys(transcripts)) {
      const transcript = transcripts[transcriptId]
      transcript.strand = selectedDestinationFeature.strand

      // update strand of transcript children if they exist
      if (transcript.children) {
        for (const childId of Object.keys(transcript.children)) {
          transcript.children[childId].strand =
            selectedDestinationFeature.strand
        }
      }
      const change = new AddFeatureChange({
        parentFeatureId: selectedDestinationFeature._id,
        changedIds: [selectedDestinationFeature._id],
        typeName: 'AddFeatureChange',
        assembly: assembly.name,
        addedFeature: transcript,
      })
      await submitChange(change)
    }
  }

  const createNewGeneFeatureWithTranscripts = async (
    childrens: Record<string, AnnotationFeatureSnapshot>,
  ) => {
    const newGeneId = new ObjectID().toHexString()
    const min = Math.min(...Object.values(childrens).map((child) => child.min))
    const max = Math.max(...Object.values(childrens).map((child) => child.max))
    const change = new AddFeatureChange({
      changedIds: [newGeneId],
      typeName: 'AddFeatureChange',
      assembly: assembly.name,
      addedFeature: {
        _id: newGeneId,
        refSeq: refSeqId,
        min,
        max,
        strand: annotationFeature.strand,
        type: 'gene',
        children: childrens,
        attributes: {
          name: [getGeneNameOrId(annotationFeature)],
          gene_name: [getGeneNameOrId(annotationFeature)],
        },
      },
    })
    await submitChange(change)
    apolloSessionModel.apolloSetSelectedFeature(newGeneId)
  }

  const extendSelectedDestinationFeatureLocation = async (
    newMin: number,
    newMax: number,
  ) => {
    if (!selectedDestinationFeature) {
      return
    }
    const changes = []
    if (newMin !== selectedDestinationFeature.min) {
      changes.push(
        new LocationStartChange({
          typeName: 'LocationStartChange',
          changedIds: [selectedDestinationFeature._id],
          featureId: selectedDestinationFeature._id,
          assembly: assembly.name,
          oldStart: selectedDestinationFeature.min,
          newStart: newMin,
        }),
      )
    }
    if (newMax !== selectedDestinationFeature.max) {
      changes.push(
        new LocationEndChange({
          typeName: 'LocationEndChange',
          changedIds: [selectedDestinationFeature._id],
          featureId: selectedDestinationFeature._id,
          assembly: assembly.name,
          oldEnd: selectedDestinationFeature.max,
          newEnd: newMax,
        }),
      )
    }
    for (const change of changes) {
      await submitChange(change)
    }
  }

  const submitChange = async (
    change: AddFeatureChange | LocationStartChange | LocationEndChange,
  ) => {
    await apolloSessionModel.apolloDataStore.changeManager.submit(change)
  }

  const handleCreateNewGeneChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setCreateNewGene(e.target.checked)
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
              label={`${getFeatureNameOrId(annotationFeature)} (${annotationFeature.min + 1}..${annotationFeature.max})`}
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
                    label={`${getFeatureNameOrId(child)} (${child.min + 1}..${child.max})`}
                  />
                ))}
            </Box>
          )}
        </Box>
        {destinationFeatures.length > 0 &&
          ((!parentFeatureChecked && checkedChildrens.length > 0) ||
            (parentFeatureChecked &&
              isTranscript(annotationFeature, apolloSessionModel))) && (
            <div
              style={{
                border: '1px solid #ccc',
                marginTop: 20,
                padding: 10,
                borderRadius: 5,
              }}
            >
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
                    disabled={createNewGene}
                  >
                    {destinationFeatures.map((f) => (
                      <MenuItem key={f._id} value={f._id}>
                        {`${getFeatureNameOrId(f)} (${f.min + 1}..${f.max})`}
                      </MenuItem>
                    ))}
                  </Select>
                </Box>
              </Box>
              <Box sx={{ ml: 3 }}>
                <FormGroup>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={createNewGene}
                        onChange={handleCreateNewGeneChange}
                      />
                    }
                    label="Create new gene"
                  />
                </FormGroup>
              </Box>
            </div>
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
