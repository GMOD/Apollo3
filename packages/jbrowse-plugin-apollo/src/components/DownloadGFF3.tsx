import gff, { GFF3Feature, GFF3FeatureLineWithRefs, GFF3Item } from '@gmod/gff'
import { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import { getConf } from '@jbrowse/core/configuration'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  MenuItem,
  Select,
  SelectChangeEvent,
} from '@mui/material'
import { AnnotationFeatureI, ApolloAssembly } from 'apollo-mst'
import { saveAs } from 'file-saver'
import { values } from 'mobx'
import { IMSTMap, getSnapshot } from 'mobx-state-tree'
import React, { useState } from 'react'

import {
  ApolloInternetAccount,
  CollaborationServerDriver,
  InMemoryFileDriver,
} from '../BackendDrivers'
import { ApolloSessionModel } from '../session'
import { createFetchErrorMessage } from '../util'

interface DownloadGFF3Props {
  session: ApolloSessionModel
  handleClose(): void
}

function makeGFF3Feature(
  feature: AnnotationFeatureI,
  parentId?: string,
): GFF3Feature {
  const locations = feature.discontinuousLocations?.length
    ? feature.discontinuousLocations
    : [
        {
          start: feature.start,
          end: feature.end,
          phase: feature.phase,
        },
      ]
  const attributes: Record<string, string[]> = {
    ...(feature.attributes ? getSnapshot(feature.attributes) : {}),
  }
  const ontologyTerms: string[] = []
  const source = feature.attributes?.get('source')?.[0] ?? null
  delete attributes.source
  if (parentId) {
    attributes.Parent = [parentId]
  }
  if (attributes._id) {
    attributes.ID = attributes._id
    delete attributes._id
  }
  if (attributes.gff_name) {
    attributes.Name = attributes.gff_name
    delete attributes.gff_name
  }
  if (attributes.gff_alias) {
    attributes.Alias = attributes.gff_alias
    delete attributes.gff_alias
  }
  if (attributes.gff_target) {
    attributes.Target = attributes.gff_target
    delete attributes.gff_target
  }
  if (attributes.gff_gap) {
    attributes.Gap = attributes.gff_gap
    delete attributes.gff_gap
  }
  if (attributes.gff_derives_from) {
    attributes.Derives_from = attributes.gff_derives_from
    delete attributes.gff_derives_from
  }
  if (attributes.gff_note) {
    attributes.Note = attributes.gff_note
    delete attributes.gff_note
  }
  if (attributes.gff_dbxref) {
    attributes.Dbxref = attributes.gff_dbxref
    delete attributes.gff_dbxref
  }
  if (attributes.gff_is_circular) {
    attributes.Is_circular = attributes.gff_is_circular
    delete attributes.gff_is_circular
  }
  if (attributes.gff_ontology_term) {
    ontologyTerms.push(...attributes.gff_ontology_term)
    delete attributes.gff_ontology_term
  }
  if (attributes['Gene Ontology']) {
    ontologyTerms.push(...attributes['Gene Ontology'])
    delete attributes['Gene Ontology']
  }
  if (attributes['Sequence Ontology']) {
    ontologyTerms.push(...attributes['Sequence Ontology'])
    delete attributes['Sequence Ontology']
  }
  if (ontologyTerms.length) {
    attributes.Ontology_term = ontologyTerms
  }
  return locations.map((location) => {
    const featureLine: GFF3FeatureLineWithRefs = {
      start: location.start,
      end: location.end,
      seq_id: feature.refSeq,
      source,
      type: feature.type,
      score: feature.score ?? null,
      strand: feature.strand ? (feature.strand === 1 ? '+' : '-') : null,
      phase:
        location.phase === 0
          ? '0'
          : location.phase === 1
          ? '1'
          : location.phase === 2
          ? '2'
          : null,
      attributes: Object.keys(attributes).length ? attributes : null,
      derived_features: [],
      child_features: [],
    }
    if (feature.children && feature.children.size > 0) {
      featureLine.child_features = values(feature.children).map((child) => {
        return makeGFF3Feature(
          child as unknown as AnnotationFeatureI,
          attributes.ID[0],
        )
      })
    }
    return featureLine
  })
}

export function DownloadGFF3({ session, handleClose }: DownloadGFF3Props) {
  const [selectedAssembly, setSelectedAssembly] = useState<Assembly>()
  const [errorMessage, setErrorMessage] = useState('')

  const { collaborationServerDriver, inMemoryFileDriver, getInternetAccount } =
    session.apolloDataStore as {
      collaborationServerDriver: CollaborationServerDriver
      inMemoryFileDriver: InMemoryFileDriver
      getInternetAccount(
        assemblyName?: string,
        internetAccountId?: string,
      ): ApolloInternetAccount
    }
  const assemblies = [
    ...collaborationServerDriver.getAssemblies(),
    ...inMemoryFileDriver.getAssemblies(),
  ]

  function handleChangeAssembly(e: SelectChangeEvent<string>) {
    const newAssembly = assemblies.find((asm) => asm.name === e.target.value)
    setSelectedAssembly(newAssembly)
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    if (!selectedAssembly) {
      setErrorMessage('Must select assembly to download')
      return
    }

    const { internetAccountConfigId } = getConf(selectedAssembly, [
      'sequence',
      'metadata',
    ]) as { internetAccountConfigId?: string }
    if (internetAccountConfigId) {
      await exportFromCollaborationServer(internetAccountConfigId)
    } else {
      exportFromMemory(session)
    }
    handleClose()
  }

  async function exportFromCollaborationServer(
    internetAccountConfigId: string,
  ) {
    if (!selectedAssembly) {
      setErrorMessage('Must select assembly to download')
      return
    }
    const internetAccount = getInternetAccount(internetAccountConfigId)
    const url = new URL('features/getExportID', internetAccount.baseURL)
    const searchParams = new URLSearchParams({
      assembly: selectedAssembly.name,
    })
    url.search = searchParams.toString()
    const uri = url.toString()
    const apolloFetch = internetAccount.getFetcher({
      locationType: 'UriLocation',
      uri,
    })
    const response = await apolloFetch(uri, { method: 'GET' })
    if (!response.ok) {
      const newErrorMessage = await createFetchErrorMessage(
        response,
        'Error when exporting ID',
      )
      setErrorMessage(newErrorMessage)
      return
    }
    const { exportID } = (await response.json()) as { exportID: string }

    const exportURL = new URL('features/exportGFF3', internetAccount.baseURL)
    const exportSearchParams = new URLSearchParams({ exportID })
    exportURL.search = exportSearchParams.toString()
    const exportUri = exportURL.toString()

    window.open(exportUri, '_blank')
  }

  function exportFromMemory(session: ApolloSessionModel) {
    if (!selectedAssembly) {
      setErrorMessage('Must select assembly to download')
      return
    }
    const { assemblies } = session.apolloDataStore as {
      assemblies: IMSTMap<typeof ApolloAssembly>
    }
    const assembly = assemblies.get(selectedAssembly.name)
    const refSeqs = assembly?.refSeqs
    if (!refSeqs) {
      setErrorMessage(
        `No refSeqs found for assembly "${selectedAssembly.name}"`,
      )
      return
    }
    const gff3Items: GFF3Item[] = [{ directive: 'gff-version', value: '3' }]
    const sequenceFeatures = getConf(selectedAssembly, [
      'sequence',
      'adapter',
      'features',
    ]) as { refName: string; start: number; end: number; seq: string }[]
    for (const sequenceFeature of sequenceFeatures) {
      const { refName, start, end } = sequenceFeature
      gff3Items.push({
        directive: 'sequence-region',
        value: `${refName} ${start + 1} ${end}`,
      })
    }
    for (const [, refSeq] of refSeqs) {
      const features = refSeq?.features
      if (!features) {
        continue
      }
      for (const [, feature] of features) {
        gff3Items.push(makeGFF3Feature(feature))
      }
    }
    for (const sequenceFeature of sequenceFeatures) {
      const { refName, seq } = sequenceFeature
      gff3Items.push({
        id: refName,
        description: '',
        sequence: seq,
      })
    }
    const gff3 = gff.formatSync(gff3Items)
    const gff3Blob = new Blob([gff3], { type: 'text/plain;charset=utf-8' })
    saveAs(
      gff3Blob,
      `${selectedAssembly.displayName ?? selectedAssembly.name}.gff3`,
    )
  }

  return (
    <Dialog open maxWidth="xl" data-testid="login-apollo">
      <DialogTitle>Export GFF3</DialogTitle>
      <form onSubmit={onSubmit}>
        <DialogContent style={{ display: 'flex', flexDirection: 'column' }}>
          <DialogContentText>Select assembly</DialogContentText>
          <Select
            labelId="label"
            value={selectedAssembly?.name ?? ''}
            onChange={handleChangeAssembly}
            disabled={!assemblies.length}
          >
            {assemblies.map((option) => (
              <MenuItem key={option.name} value={option.name}>
                {option.displayName ?? option.name}
              </MenuItem>
            ))}
          </Select>
          <DialogContentText>
            Select assembly to export to GFF3
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            disabled={!selectedAssembly}
            variant="contained"
            type="submit"
          >
            Download
          </Button>
          <Button
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
