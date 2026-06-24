/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable @typescript-eslint/unbound-method */
import type { AnnotationFeatureSnapshot } from '@apollo-annotation/mst'
import {
  AddFeatureChange,
  DeleteFeatureChange,
} from '@apollo-annotation/shared'
import {
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
} from '@mui/material'
import ObjectID from 'bson-objectid'
import React, { useState } from 'react'

import type { ChangeManager } from '../ChangeManager'

import { Dialog } from './Dialog'

type Choice = 'keepExisting' | 'useNew' | 'keepBoth'

interface DuplicateFeatureDialogProps {
  featureSnapshot: AnnotationFeatureSnapshot
  existingFeature: AnnotationFeatureSnapshot
  assemblyName: string
  changeManager: ChangeManager
  handleClose(): void
}

function reassignIds(
  feature: AnnotationFeatureSnapshot,
): AnnotationFeatureSnapshot {
  const newChildren: Record<string, AnnotationFeatureSnapshot> = {}
  if (feature.children) {
    for (const child of Object.values(feature.children)) {
      const newChild = reassignIds(child)
      newChildren[newChild._id] = newChild
    }
  }
  return {
    ...feature,
    _id: new ObjectID().toHexString(),
    children: feature.children ? newChildren : undefined,
  }
}

export function DuplicateFeatureDialog({
  assemblyName,
  changeManager,
  existingFeature,
  featureSnapshot,
  handleClose,
}: DuplicateFeatureDialogProps) {
  const [choice, setChoice] = useState<Choice>('keepExisting')
  const [errorMessage, setErrorMessage] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async () => {
    setErrorMessage('')
    setSubmitted(true)
    try {
      if (choice === 'useNew') {
        const deleteChange = new DeleteFeatureChange({
          typeName: 'DeleteFeatureChange',
          assembly: assemblyName,
          changedIds: [existingFeature._id],
          deletedFeature: existingFeature,
        })
        await changeManager.submit(deleteChange)
        const addChange = new AddFeatureChange({
          typeName: 'AddFeatureChange',
          assembly: assemblyName,
          changedIds: [featureSnapshot._id],
          addedFeature: featureSnapshot,
        })
        await changeManager.submit(addChange)
      } else if (choice === 'keepBoth') {
        const newSnapshot = reassignIds(featureSnapshot)
        const addChange = new AddFeatureChange({
          typeName: 'AddFeatureChange',
          assembly: assemblyName,
          changedIds: [newSnapshot._id],
          addedFeature: newSnapshot,
        })
        await changeManager.submit(addChange)
      }
      handleClose()
    } catch (error) {
      setErrorMessage(String(error))
      setSubmitted(false)
    }
  }

  return (
    <Dialog
      open
      title="Duplicate Feature Detected"
      handleClose={handleClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogContent>
        <DialogContentText>
          A feature with ID &ldquo;{featureSnapshot._id}&rdquo; already exists.
          How would you like to resolve this conflict?
        </DialogContentText>
        <FormControl component="fieldset" sx={{ mt: 2 }}>
          <FormLabel component="legend">Resolution</FormLabel>
          <RadioGroup
            value={choice}
            onChange={(e) => {
              setChoice(e.target.value as Choice)
            }}
          >
            <FormControlLabel
              value="keepExisting"
              control={<Radio />}
              label="Keep the existing feature"
            />
            <FormControlLabel
              value="useNew"
              control={<Radio />}
              label="Replace with the new feature"
            />
            <FormControlLabel
              value="keepBoth"
              control={<Radio />}
              label="Keep both (assign new IDs to the incoming feature)"
            />
          </RadioGroup>
        </FormControl>
        {errorMessage ? (
          <DialogContentText color="error" sx={{ mt: 1 }}>
            {errorMessage}
          </DialogContentText>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={handleSubmit} disabled={submitted}>
          Confirm
        </Button>
        <Button onClick={handleClose} disabled={submitted}>
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  )
}
