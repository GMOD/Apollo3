import gff, { GFF3Feature, GFF3Sequence } from '@gmod/gff'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  FormHelperText,
  TextField,
  useTheme,
} from '@mui/material'
import { AnnotationFeatureSnapshot } from 'apollo-mst'
import { nanoid } from 'nanoid'
import React, { useState } from 'react'

import { InMemoryFileDriver } from '../BackendDrivers'
import { ApolloSessionModel } from '../session'

interface OpenLocalFileProps {
  session: ApolloSessionModel
  handleClose(): void
  inMemoryFileDriver: InMemoryFileDriver
}

export interface RefSeqInterface {
  refName: string
  uniqueId: string
  aliases?: string[]
}

export interface SequenceAdapterFeatureInterface {
  refName: string
  uniqueId: string
  start: number
  end: number
  seq: string
}

export function OpenLocalFile({ handleClose, session }: OpenLocalFileProps) {
  const {
    addApolloTrackConfig,
    addAssembly,
    addSessionAssembly,
    assemblyManager,
    notify,
  } = session as ApolloSessionModel

  const [file, setFile] = useState<File | null>(null)
  const [assemblyName, setAssemblyName] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const theme = useTheme()

  async function handleChangeFile(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.item(0)
    if (!selectedFile) {
      return
    }
    setErrorMessage('')
    setFile(selectedFile)
    if (!assemblyName) {
      const fileName = selectedFile.name
      const lastDotIndex = fileName.lastIndexOf('.')
      if (lastDotIndex === -1) {
        setAssemblyName(fileName)
      } else {
        setAssemblyName(fileName.slice(0, lastDotIndex))
      }
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    setSubmitted(true)

    if (!file) {
      throw new Error('No file selected')
    }

    // Right now we are not using stream because there was a problem with 'pipe' in ReadStream
    const fileData = await new Response(file).text()
    let featuresAndSequences: (GFF3Feature | GFF3Sequence)[] = []
    try {
      featuresAndSequences = gff.parseStringSync(fileData, {
        parseSequences: true,
        parseComments: false,
        parseDirectives: false,
        parseFeatures: true,
      })
    } catch (error) {
      setSubmitted(false)
      setErrorMessage(`Error parsing GFF3 file: ${error}`)
    }
    if (featuresAndSequences.length === 0) {
      setErrorMessage('No features found in GFF3 file')
      setSubmitted(false)
    }

    const assemblyId = `${assemblyName}-${file.name}-${nanoid(8)}`

    const sequenceAdapterFeatures: SequenceAdapterFeatureInterface[] = []
    let assembly = session.apolloDataStore.assemblies.get(assemblyId)
    if (!assembly) {
      assembly = session.apolloDataStore.addAssembly(assemblyId)
    }
    for (const seqLine of featuresAndSequences) {
      if (Array.isArray(seqLine)) {
        // regular feature
        const feature = createFeature(seqLine)
        let ref = assembly.refSeqs.get(feature.refSeq)
        if (!ref) {
          ref = assembly.addRefSeq(feature.refSeq, feature.refSeq)
        }
        if (!ref.features.has(feature._id)) {
          ref.addFeature(feature)
        }
      } else {
        // sequence feature
        sequenceAdapterFeatures.push({
          refName: seqLine.id,
          uniqueId: `${assemblyId}-${seqLine.id}`,
          start: 0,
          end: seqLine.sequence.length,
          seq: seqLine.sequence,
        })
      }
    }
    if (sequenceAdapterFeatures.length === 0) {
      setErrorMessage('No embedded FASTA section found in GFF3')
      setSubmitted(false)
      return
    }

    const assemblyConfig = {
      name: assemblyId,
      aliases: [assemblyName],
      displayName: assemblyName,
      sequence: {
        trackId: `sequenceConfigId-${assemblyName}`,
        type: 'ReferenceSequenceTrack',
        adapter: {
          type: 'FromConfigSequenceAdapter',
          assemblyId,
          features: sequenceAdapterFeatures,
        },
        metadata: { apollo: true },
      },
    }

    // Save assembly into session
    await (addSessionAssembly || addAssembly)(assemblyConfig)
    const a = await assemblyManager.waitForAssembly(assemblyConfig.name)
    addApolloTrackConfig(a)
    notify(`Loaded GFF3 ${file?.name}`, 'success')
    handleClose()
  }

  function handleAssemblyNameChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    setAssemblyName(event.target.value)
  }

  return (
    <Dialog open maxWidth="xl" data-testid="login-apollo">
      <DialogTitle>Open local GFF3 file</DialogTitle>
      <form onSubmit={onSubmit}>
        <DialogContent style={{ display: 'flex', flexDirection: 'column' }}>
          <FormControl>
            <div style={{ flexDirection: 'row' }}>
              <Button
                variant="contained"
                component="label"
                style={{ marginRight: theme.spacing() }}
              >
                Choose File
                <input
                  type="file"
                  required
                  hidden
                  onChange={handleChangeFile}
                />
              </Button>
              {file ? file.name : 'No file chosen'}
            </div>
            <FormHelperText>
              Make sure your GFF3 has an embedded FASTA section
            </FormHelperText>
          </FormControl>
          <TextField
            required
            label="Assembly name"
            value={assemblyName}
            onChange={handleAssemblyNameChange}
          />
        </DialogContent>
        <DialogActions>
          <Button
            disabled={!(file && assemblyName)}
            variant="contained"
            type="submit"
          >
            {submitted ? 'Submitting...' : 'Submit'}
          </Button>
          <Button
            disabled={submitted}
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

function createFeature(gff3Feature: GFF3Feature): AnnotationFeatureSnapshot {
  const [firstFeature] = gff3Feature
  const {
    attributes,
    child_features: childFeatures,
    end,
    phase,
    score,
    seq_id: refName,
    source,
    start,
    strand,
    type,
  } = firstFeature
  if (!refName) {
    throw new Error(
      `feature does not have seq_id: ${JSON.stringify(firstFeature)}`,
    )
  }
  if (!type) {
    throw new Error(
      `feature does not have type: ${JSON.stringify(firstFeature)}`,
    )
  }
  if (start === null) {
    throw new Error(
      `feature does not have start: ${JSON.stringify(firstFeature)}`,
    )
  }
  if (end === null) {
    throw new Error(
      `feature does not have end: ${JSON.stringify(firstFeature)}`,
    )
  }
  const feature: AnnotationFeatureSnapshot = {
    _id: nanoid(),
    gffId: '',
    refSeq: refName,
    type,
    start,
    end,
  }
  if (gff3Feature.length > 1) {
    feature.discontinuousLocations = gff3Feature.map((f) => {
      const { end: subEnd, phase: locationPhase, start: subStart } = f
      if (subStart === null || subEnd === null) {
        throw new Error(
          `feature does not have start and/or end: ${JSON.stringify(f)}`,
        )
      }
      let parsedPhase: 0 | 1 | 2 | undefined = undefined
      if (locationPhase) {
        if (locationPhase === '0') {
          parsedPhase = 0
        } else if (locationPhase === '1') {
          parsedPhase = 1
        } else if (locationPhase === '2') {
          parsedPhase = 2
        } else {
          throw new Error(`Unknown phase: "${locationPhase}"`)
        }
      }
      return { start: subStart, end: subEnd, phase: parsedPhase }
    })
  }
  if (strand) {
    if (strand === '+') {
      feature.strand = 1
    } else if (strand === '-') {
      feature.strand = -1
    } else {
      throw new Error(`Unknown strand: "${strand}"`)
    }
  }
  if (score !== null) {
    feature.score = score
  }
  if (phase) {
    if (phase === '0') {
      feature.phase = 0
    } else if (phase === '1') {
      feature.phase = 1
    } else if (phase === '2') {
      feature.phase = 2
    } else {
      throw new Error(`Unknown phase: "${phase}"`)
    }
  }

  if (childFeatures?.length) {
    const children: Record<string, AnnotationFeatureSnapshot> = {}
    for (const childFeature of childFeatures) {
      const child = createFeature(childFeature)
      children[child._id] = child
      // Add value to gffId
      child.attributes?._id
        ? (child.gffId = child.attributes?._id.toString())
        : (child.gffId = child._id)
    }
    feature.children = children
  }
  if (source ?? attributes) {
    const attrs: Record<string, string[]> = {}
    if (source) {
      attrs.source = [source]
    }
    if (attributes) {
      Object.entries(attributes).forEach(([key, val]) => {
        if (val) {
          const newKey = key.toLowerCase()
          if (newKey !== 'parent') {
            // attrs[key.toLowerCase()] = val
            switch (key) {
              case 'ID':
                attrs._id = val
                break
              case 'Name':
                attrs.gff_name = val
                break
              case 'Alias':
                attrs.gff_alias = val
                break
              case 'Target':
                attrs.gff_target = val
                break
              case 'Gap':
                attrs.gff_gap = val
                break
              case 'Derives_from':
                attrs.gff_derives_from = val
                break
              case 'Note':
                attrs.gff_note = val
                break
              case 'Dbxref':
                attrs.gff_dbxref = val
                break
              case 'Ontology_term': {
                const goTerms: string[] = []
                const otherTerms: string[] = []
                val.forEach((v) => {
                  if (v.startsWith('GO:')) {
                    goTerms.push(v)
                  } else {
                    otherTerms.push(v)
                  }
                })
                if (goTerms.length) {
                  attrs['Gene Ontology'] = goTerms
                }
                if (otherTerms.length) {
                  attrs.gff_ontology_term = otherTerms
                }
                break
              }
              case 'Is_circular':
                attrs.gff_is_circular = val
                break
              default:
                attrs[key.toLowerCase()] = val
            }
          }
        }
      })
    }
    feature.attributes = attrs
  }
  return feature
}
