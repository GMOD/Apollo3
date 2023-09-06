import path from 'node:path'

import gff, { GFF3Feature, GFF3Sequence } from '@gmod/gff'
import { AbstractSessionModel, isElectron } from '@jbrowse/core/util'
// class FakeCheck extends Check {
//   async checkFeature(
//     feature: AnnotationFeatureSnapshot,
//   ): Promise<CheckResultSnapshot> {
//     const { _id, end, refSeq, start } = feature
//     const id = _id.toString()
//     return {
//       _id: `${id}-fake`,
//       name: 'FakeInMemoryCheckResult',
//       ids: [id],
//       refSeq: refSeq.toString(),
//       start,
//       end,
//       message: `This is a fake result for feature ${id}`,
//     }
//   }
// }
import { storeBlobLocation } from '@jbrowse/core/util/tracks'
import {
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
  FormControl,
  FormHelperText,
  TextField,
  useTheme,
} from '@mui/material'
// import { Check } from 'apollo-common'
import { AnnotationFeatureSnapshot, CheckResultSnapshot } from 'apollo-mst'
import { nanoid } from 'nanoid'
import React, { useState } from 'react'

import { InMemoryFileDriver } from '../BackendDrivers'
import { ApolloSessionModel } from '../session'
import { Dialog } from './Dialog'

const { ipcRenderer } = window.require('electron')

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

export function OpenLocalFile({ handleClose, session }: OpenLocalFileProps) {
  const { addApolloTrackConfig, apolloDataStore } = session
  const { addAssembly, addSessionAssembly, assemblyManager, notify } =
    session as unknown as AbstractSessionModel & {
      // eslint-disable-next-line @typescript-eslint/ban-types
      addSessionAssembly: Function
    }

  const [file, setFile] = useState<File | null>(null)
  const [assemblyName, setAssemblyName] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [fileContent, setFileContent] = useState('')
  const [fileName, setFileName] = useState('')
  const [selectedFilePath, setSelectedFilePath] = useState('')
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

    let fileData: string
    if (isElectron) {
      fileData = fileContent
    } else {
      if (!file) {
        throw new Error('No file selected')
      }
      setFileName(file.name)
      // Right now we are not using stream because there was a problem with 'pipe' in ReadStream
      fileData = await new Response(file).text()
    }
    let featuresAndSequences: (GFF3Feature | GFF3Sequence)[] = []
    try {
      featuresAndSequences = gff.parseStringSync(fileData, {
        parseSequences: true,
        parseComments: false,
        parseDirectives: false,
        parseFeatures: true,
        // parseFeatures: isElectron ? false : true,
      })
    } catch (error) {
      setSubmitted(false)
      setErrorMessage(`Error parsing GFF3 file: ${error}`)
    }
    if (featuresAndSequences.length === 0) {
      setErrorMessage('No features found in GFF3 file')
      setSubmitted(false)
    }

    const assemblyId = `${assemblyName}-${fileName}-${nanoid(8)}`

    let sequenceFeatureCount = 0
    let assembly = apolloDataStore.assemblies.get(assemblyId)
    if (!assembly) {
      assembly = apolloDataStore.addAssembly(assemblyId)
    }

    const checkResults: CheckResultSnapshot[] = []
    for (const seqLine of featuresAndSequences) {
      if (Array.isArray(seqLine)) {
        // feature
        const feature = createFeature(seqLine)

        // const fakeCheck = new FakeCheck()
        // const checkResult = await fakeCheck.checkFeature(feature)
        // if (checkResult) {
        //   checkResults.push(checkResult)
        // }

        let ref = assembly.refSeqs.get(feature.refSeq)
        if (!ref) {
          ref = assembly.addRefSeq(feature.refSeq, feature.refSeq)
        }
        if (!ref.features.has(feature._id)) {
          ref.addFeature(feature)
        }
      } else {
        let ref = assembly.refSeqs.get(seqLine.id)
        // sequence
        sequenceAdapterFeatures.push({
          refName: seqLine.id,
          uniqueId: `${assemblyId}-${seqLine.id}`,
          start: 0,
          stop: seqLine.sequence.length,
          sequence: seqLine.sequence,
        })
        if (!ref) {
          ref = assembly.addRefSeq(seqLine.id, seqLine.id)
        }
        ref.addSequence({
          start: 0,
          stop: seqLine.sequence.length,
          sequence: seqLine.sequence,
        })
      }
    }
    apolloDataStore.addCheckResults(checkResults)

    if (sequenceFeatureCount === 0) {
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
        adapter: { type: 'ApolloSequenceAdapter', assemblyId },
        metadata: {
          apollo: true,
          file: isElectron ? selectedFilePath : undefined,
        },
      },
    }
    // Save assembly into session
    await (addSessionAssembly || addAssembly)(assemblyConfig)
    const a = await assemblyManager.waitForAssembly(assemblyConfig.name)
    if (a) {
      // @ts-expect-error MST type coercion problem?
      addApolloTrackConfig(a)
      notify(`Loaded GFF3 ${file?.name}`, 'success')
    } else {
      notify(`Error loading GFF3 ${file?.name}`, 'error')
    }
    handleClose()
  }

  function handleAssemblyNameChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    setAssemblyName(event.target.value)
  }

  const uploadFile = () => {
    ipcRenderer
      .invoke('promptOpenGFF3File')
      .then((selectedFilePath: string) => {
        if (!selectedFilePath) {
          return
        }
        setSelectedFilePath(selectedFilePath)
        const fileNam = path.basename(selectedFilePath)
        setFileName(fileNam)
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const fs = require('node:fs')
        try {
          const content = fs.readFileSync(selectedFilePath, 'utf8')
          setFileContent(content)
        } catch (error) {
          console.error('Error reading file:', error)
        }

        setErrorMessage('')
        if (!assemblyName) {
          const lastDotIndex = fileNam.lastIndexOf('.')
          if (lastDotIndex === -1) {
            setAssemblyName(fileNam)
          } else {
            setAssemblyName(fileNam.slice(0, lastDotIndex))
          }
        }
      })
  }
  return (
    <Dialog
      open
      title="Open local GFF3 file"
      handleClose={handleClose}
      maxWidth={false}
      data-testid="open-local-file"
    >
      <form onSubmit={onSubmit}>
        <DialogContent style={{ display: 'flex', flexDirection: 'column' }}>
          <FormControl>
            <div style={{ flexDirection: 'row' }}>
              {isElectron ? (
                <button onClick={uploadFile}>Upload File</button>
              ) : (
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
              )}
              {isElectron
                ? fileName
                  ? fileName
                  : 'No file chosen'
                : file
                ? file.name
                : 'No file chosen'}
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
            // disabled={!(file && assemblyName)}
            // disabled={!(!isElectron && file && assemblyName)}
            disabled={false}
            variant="contained"
            type="submit"
          >
            {submitted ? 'Submitting...' : 'Submit'}
          </Button>
          <Button
            disabled={submitted}
            variant="outlined"
            type="submit"
            onClick={handleClose}
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
    start: start - 1,
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
      let parsedPhase: 0 | 1 | 2 | undefined
      if (locationPhase) {
        switch (locationPhase) {
          case '0': {
            parsedPhase = 0

            break
          }
          case '1': {
            parsedPhase = 1

            break
          }
          case '2': {
            parsedPhase = 2

            break
          }
          default: {
            throw new Error(`Unknown phase: "${locationPhase}"`)
          }
        }
      }
      return { start: subStart - 1, end: subEnd, phase: parsedPhase }
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
    switch (phase) {
      case '0': {
        feature.phase = 0

        break
      }
      case '1': {
        feature.phase = 1

        break
      }
      case '2': {
        feature.phase = 2

        break
      }
      default: {
        throw new Error(`Unknown phase: "${phase}"`)
      }
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
      for (const [key, val] of Object.entries(attributes)) {
        if (val) {
          const newKey = key.toLowerCase()
          if (newKey !== 'parent') {
            // attrs[key.toLowerCase()] = val
            switch (key) {
              case 'ID': {
                attrs._id = val
                break
              }
              case 'Name': {
                attrs.gff_name = val
                break
              }
              case 'Alias': {
                attrs.gff_alias = val
                break
              }
              case 'Target': {
                attrs.gff_target = val
                break
              }
              case 'Gap': {
                attrs.gff_gap = val
                break
              }
              case 'Derives_from': {
                attrs.gff_derives_from = val
                break
              }
              case 'Note': {
                attrs.gff_note = val
                break
              }
              case 'Dbxref': {
                attrs.gff_dbxref = val
                break
              }
              case 'Ontology_term': {
                const goTerms: string[] = []
                const otherTerms: string[] = []
                for (const v of val) {
                  if (v.startsWith('GO:')) {
                    goTerms.push(v)
                  } else {
                    otherTerms.push(v)
                  }
                }
                if (goTerms.length > 0) {
                  attrs['Gene Ontology'] = goTerms
                }
                if (otherTerms.length > 0) {
                  attrs.gff_ontology_term = otherTerms
                }
                break
              }
              case 'Is_circular': {
                attrs.gff_is_circular = val
                break
              }
              default: {
                attrs[key.toLowerCase()] = val
              }
            }
          }
        }
      }
    }
    feature.attributes = attrs
  }
  return feature
}
