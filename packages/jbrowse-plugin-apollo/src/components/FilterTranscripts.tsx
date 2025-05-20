import React, { useState } from 'react'
import { Dialog } from './Dialog'
import {
  Checkbox,
  DialogContent,
  DialogContentText,
  FormControlLabel,
  FormGroup,
  Grid2,
} from '@mui/material'
import { observer } from 'mobx-react'
import { AnnotationFeature } from '@apollo-annotation/mst'

interface FilterTranscriptsProps {
  onUpdate: (forms: string[]) => void
  sourceFeature: AnnotationFeature
  filteredTranscripts: string[]
  handleClose: () => void
}

export const FilterTranscripts = observer(function FilterTranscripts({
  sourceFeature,
  filteredTranscripts,
  handleClose,
  onUpdate,
}: FilterTranscriptsProps) {
  const allTranscripts: string[] = []
  if (sourceFeature.children) {
    for (const [, child] of sourceFeature.children) {
      const childID: string | undefined = child.attributes
        .get('gff_id')
        ?.toString()
      if (childID) {
        allTranscripts.push(childID)
      }
    }
  }
  const [excludedTranscripts, setExcludedTranscripts] =
    useState<string[]>(filteredTranscripts)
  const handleChange = (value: string) => {
    const newForms = excludedTranscripts.includes(value)
      ? excludedTranscripts.filter((form) => form !== value)
      : [...excludedTranscripts, value]
    onUpdate(newForms)
    setExcludedTranscripts(newForms)
  }

  return (
    <Dialog
      open
      maxWidth={false}
      data-testid="filter-transcripts-dialog"
      title="Filter transcripts by ID"
      handleClose={handleClose}
    >
      <DialogContent>
        <DialogContentText>
          Select the alternate transcripts you want to display in the apollo
          track
        </DialogContentText>
        <Grid2 container spacing={2}>
          <Grid2 size={8}>
            <FormGroup>
              {allTranscripts.map((item) => (
                // eslint-disable-next-line react/jsx-key
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={!excludedTranscripts.includes(item)}
                      onChange={() => {
                        handleChange(item)
                      }}
                      inputProps={{ 'aria-label': 'controlled' }}
                    />
                  }
                  label={item}
                />
              ))}
            </FormGroup>
          </Grid2>
        </Grid2>
      </DialogContent>
    </Dialog>
  )
})
