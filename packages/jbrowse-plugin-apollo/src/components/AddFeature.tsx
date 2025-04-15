/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/no-misused-promises */
import { AddFeatureChange } from '@apollo-annotation/shared'
import { AbstractSessionModel, Region } from '@jbrowse/core/util/types'
import {
  Box,
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  SelectChangeEvent,
  TextField,
  Tooltip,
} from '@mui/material'

import InfoIcon from '@mui/icons-material/Info'

import ObjectID from 'bson-objectid'
import React, { useState } from 'react'

import { ChangeManager } from '../ChangeManager'
import { isOntologyClass } from '../OntologyManager'
import { ApolloSessionModel } from '../session'
import { Dialog } from './Dialog'
import { OntologyTermAutocomplete } from './OntologyTermAutocomplete'
import { AnnotationFeatureSnapshot } from '@apollo-annotation/mst'

interface AddFeatureProps {
  session: ApolloSessionModel
  handleClose(): void
  region: Region
  changeManager: ChangeManager
}

enum NewFeature {
  GENE_AND_SUBFEATURES = 'GENE_AND_SUBFEATURES',
  TRANSCRIPT_AND_SUBFEATURES = 'TRANSCRIPT_AND_SUBFEATURES',
  CUSTOM = '',
}

function makeCodingMrna(
  refSeqId: string,
  strand: 1 | -1 | undefined,
  min: number,
  max: number,
): AnnotationFeatureSnapshot {
  const cds = {
    _id: new ObjectID().toHexString(),
    refSeq: refSeqId,
    type: 'CDS',
    min,
    max,
    strand,
  } as AnnotationFeatureSnapshot

  const exon = {
    _id: new ObjectID().toHexString(),
    refSeq: refSeqId,
    type: 'exon',
    min,
    max,
    strand,
  } as AnnotationFeatureSnapshot

  const children: Record<string, AnnotationFeatureSnapshot> = {}
  children[cds._id] = cds
  children[exon._id] = exon

  const mRNA = {
    _id: new ObjectID().toHexString(),
    refSeq: refSeqId,
    type: 'mRNA',
    min,
    max,
    strand,
    children,
  } as AnnotationFeatureSnapshot

  return mRNA
}

export function AddFeature({
  changeManager,
  handleClose,
  region,
  session,
}: AddFeatureProps) {
  const { notify } = session as unknown as AbstractSessionModel
  const [end, setEnd] = useState(String(region.end))
  const [start, setStart] = useState(String(region.start + 1))
  const [type, setType] = useState(NewFeature.GENE_AND_SUBFEATURES.toString())
  const [strand, setStrand] = useState<1 | -1 | undefined>()
  const [errorMessage, setErrorMessage] = useState('')

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')

    let refSeqId
    for (const [, asm] of session.apolloDataStore.assemblies ?? new Map()) {
      if (asm._id === region.assemblyName) {
        for (const [, refseq] of asm.refSeqs ?? new Map()) {
          if (refseq.name === region.refName) {
            refSeqId = refseq._id
          }
        }
      }
    }

    if (!refSeqId) {
      setErrorMessage('Invalid refseq id')
      return
    }

    let change
    if (type === NewFeature.GENE_AND_SUBFEATURES.toString()) {
      const mRNA = makeCodingMrna(
        refSeqId,
        strand,
        Number(start) - 1,
        Number(end),
      )
      const children: Record<string, AnnotationFeatureSnapshot> = {}
      children[mRNA._id] = mRNA

      const id = new ObjectID().toHexString()
      change = new AddFeatureChange({
        changedIds: [id],
        typeName: 'AddFeatureChange',
        assembly: region.assemblyName,
        addedFeature: {
          _id: id,
          refSeq: refSeqId,
          min: Number(start) - 1,
          max: Number(end),
          type: 'gene',
          strand,
          children,
        },
      })
    } else if (type === NewFeature.TRANSCRIPT_AND_SUBFEATURES.toString()) {
      const mRNA = makeCodingMrna(
        refSeqId,
        strand,
        Number(start) - 1,
        Number(end),
      )
      change = new AddFeatureChange({
        changedIds: [mRNA._id],
        typeName: 'AddFeatureChange',
        assembly: region.assemblyName,
        addedFeature: mRNA,
      })
    } else {
      const id = new ObjectID().toHexString()
      change = new AddFeatureChange({
        changedIds: [id],
        typeName: 'AddFeatureChange',
        assembly: region.assemblyName,
        addedFeature: {
          _id: id,
          refSeq: refSeqId,
          min: Number(start) - 1,
          max: Number(end),
          type,
          strand,
        },
      })
    }
    await changeManager.submit(change)
    notify('Feature added successfully', 'success')
    handleClose()
    return
  }

  function handleChangeStrand(e: SelectChangeEvent) {
    setErrorMessage('')

    switch (Number(e.target.value)) {
      case 1: {
        setStrand(1)
        break
      }
      case -1: {
        setStrand(-1)
        break
      }
      default: {
        setStrand(undefined)
      }
    }
  }

  const error = Number(end) <= Number(start)

  function handleChangeOntologyType(newType: string) {
    setErrorMessage('')
    setType(newType)
  }

  const handleTypeChange = (e: SelectChangeEvent) => {
    setErrorMessage('')
    setType(e.target.value)
  }

  return (
    <Dialog
      open
      title="Add new feature"
      handleClose={handleClose}
      maxWidth={false}
      data-testid="add-feature-dialog"
    >
      <form onSubmit={onSubmit} data-testid="submit-form">
        <DialogContent style={{ display: 'flex', flexDirection: 'column' }}>
          <TextField
            margin="dense"
            id="start"
            label="Start"
            type="number"
            fullWidth
            variant="outlined"
            value={Number(start)}
            onChange={(e) => {
              setStart(e.target.value)
            }}
          />
          <TextField
            margin="dense"
            id="end"
            label="End"
            type="number"
            fullWidth
            variant="outlined"
            value={end}
            onChange={(e) => {
              setEnd(e.target.value)
            }}
            error={error}
            helperText={error ? '"End" must be greater than "Start"' : null}
          />
          <FormControl>
            <InputLabel id="demo-simple-select-label">Strand</InputLabel>
            <Select
              labelId="demo-simple-select-label"
              id="demo-simple-select"
              label="Strand"
              value={strand?.toString()}
              onChange={handleChangeStrand}
            >
              <MenuItem value={undefined}></MenuItem>
              <MenuItem value={1}>+</MenuItem>
              <MenuItem value={-1}>-</MenuItem>
            </Select>
          </FormControl>

          <FormControl style={{ marginTop: 20 }}>
            <RadioGroup
              aria-labelledby="demo-radio-buttons-group-label"
              defaultValue={NewFeature.GENE_AND_SUBFEATURES}
              name="radio-buttons-group"
              value={type}
              onChange={handleTypeChange}
            >
              <FormControlLabel
                value={NewFeature.GENE_AND_SUBFEATURES}
                control={<Radio />}
                label={
                  <Box display="flex" alignItems="center">
                    Add gene and sub-features
                    <Tooltip title="This is a shortcut to create a gene with a single mRNA, exon, and CDS">
                      <IconButton size="small">
                        <InfoIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                }
              />

              <FormControlLabel
                value={NewFeature.TRANSCRIPT_AND_SUBFEATURES}
                control={<Radio />}
                label={
                  <Box display="flex" alignItems="center">
                    Add transcript and sub-features
                    <Tooltip title="This is a shortcut to create a single mRNA with exon and CDS, but without a parent gene">
                      <IconButton size="small">
                        <InfoIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                }
              />
              <FormControlLabel
                value={NewFeature.CUSTOM.toString()}
                checked={
                  type !== NewFeature.GENE_AND_SUBFEATURES.toString() &&
                  type !== NewFeature.TRANSCRIPT_AND_SUBFEATURES.toString()
                }
                control={<Radio />}
                label="Add feature with with a sequence ontology type"
              />
            </RadioGroup>
          </FormControl>
          {type === NewFeature.CUSTOM.toString() ? (
            <OntologyTermAutocomplete
              session={session}
              ontologyName="Sequence Ontology"
              style={{ width: 170 }}
              value=""
              filterTerms={isOntologyClass}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Type"
                  variant="outlined"
                  fullWidth
                />
              )}
              onChange={(_oldValue, newValue) => {
                if (newValue) {
                  handleChangeOntologyType(newValue)
                }
              }}
            />
          ) : null}
          {type !== NewFeature.GENE_AND_SUBFEATURES.toString() &&
          type !== NewFeature.TRANSCRIPT_AND_SUBFEATURES.toString() &&
          type !== NewFeature.CUSTOM.toString() ? (
            <TextField
              label=""
              defaultValue={type}
              slotProps={{
                input: {
                  readOnly: true,
                },
              }}
            />
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button
            variant="contained"
            type="submit"
            disabled={error || !(start && end && type)}
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
