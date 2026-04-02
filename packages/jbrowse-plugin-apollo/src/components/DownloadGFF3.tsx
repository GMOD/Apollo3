/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-misused-promises */
import { annotationFeatureToGFF3 } from '@apollo-annotation/shared'
import { GFFFormattingTransformer } from '@gmod/gff'
import { getConf } from '@jbrowse/core/configuration'
import type { AbstractSessionModel } from '@jbrowse/core/util'
import {
  Button,
  Checkbox,
  DialogActions,
  DialogContent,
  DialogContentText,
  FormControlLabel,
  FormGroup,
  SvgIcon,
  type SvgIconProps,
} from '@mui/material'
import { saveAs } from 'file-saver'
import React, { useState } from 'react'

import type {
  ApolloInternetAccount,
  CollaborationServerDriver,
} from '../BackendDrivers'
import { openDb } from '../BackendDrivers/LocalDriver/db'
import type { ApolloSessionModel } from '../session'
import { createFetchErrorMessage } from '../util'

import { Dialog } from './Dialog'

interface DownloadGFF3Props {
  session: ApolloSessionModel
  handleClose(): void
  assembly: string
}

// Icon source: https://pictogrammers.com/library/mdi/icon/export/
export function Export(props: SvgIconProps) {
  return (
    <SvgIcon viewBox="0 0 24 24" {...props}>
      <path d="M23,12L19,8V11H10V13H19V16M1,18V6C1,4.89 1.9,4 3,4H15A2,2 0 0,1 17,6V9H15V6H3V18H15V15H17V18A2,2 0 0,1 15,20H3A2,2 0 0,1 1,18Z" />
    </SvgIcon>
  )
}

export function DownloadGFF3({
  handleClose,
  session,
  assembly: assemblyName,
}: DownloadGFF3Props) {
  const [includeFASTA, setincludeFASTA] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const { getInternetAccount } = session.apolloDataStore as {
    collaborationServerDriver: CollaborationServerDriver
    getInternetAccount(
      assemblyName?: string,
      internetAccountId?: string,
    ): ApolloInternetAccount
  }

  const { assemblyManager } = session as unknown as AbstractSessionModel
  const assembly = assemblyManager.get(assemblyName)
  if (!assembly) {
    setErrorMessage(`Assembly "${assemblyName}" not found`)
    return
  }

  const { internetAccountConfigId } = getConf(assembly, [
    'sequence',
    'metadata',
  ]) as { internetAccountConfigId?: string }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')

    await (internetAccountConfigId
      ? exportFromCollaborationServer(internetAccountConfigId)
      : downloadAssemblyGFF3(assemblyName))
    handleClose()
  }

  async function exportFromCollaborationServer(
    internetAccountConfigId: string,
  ) {
    const internetAccount = getInternetAccount(
      assemblyName,
      internetAccountConfigId,
    )
    const url = new URL('export/getID', internetAccount.baseURL)
    const searchParams = new URLSearchParams({ assembly: assemblyName })
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

    const exportURL = new URL('export', internetAccount.baseURL)
    const params: Record<string, string> = {
      exportID,
      includeFASTA: includeFASTA ? 'true' : 'false',
    }
    const exportSearchParams = new URLSearchParams(params)
    exportURL.search = exportSearchParams.toString()
    const exportUri = exportURL.toString()

    window.open(exportUri, '_blank')
  }

  return (
    <Dialog
      open
      title="Export annotations"
      handleClose={handleClose}
      maxWidth={false}
      data-testid="download-gff3"
    >
      <form onSubmit={onSubmit}>
        <DialogContent style={{ display: 'flex', flexDirection: 'column' }}>
          <DialogContentText>
            Exporting annotations for {assemblyName}
          </DialogContentText>
          <FormGroup>
            <FormControlLabel
              data-testid="include-fasta-checkbox"
              control={
                <Checkbox
                  checked={includeFASTA}
                  onChange={() => {
                    setincludeFASTA(!includeFASTA)
                  }}
                  disabled={!internetAccountConfigId}
                />
              }
              label="Include fasta sequence in GFF output"
            />
          </FormGroup>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" type="submit">
            Download
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

function getAssemblyGFF3Stream(assemblyName: string): ReadableStream<string> {
  const featureStream = new ReadableStream({
    async start(controller) {
      for await (const feature of getFeaturesForAssembly(assemblyName)) {
        const gff3Feature = annotationFeatureToGFF3(feature)
        controller.enqueue(gff3Feature)
      }
      controller.close()
    },
  })
  return featureStream.pipeThrough(
    new TransformStream(new GFFFormattingTransformer()),
  )
}

async function downloadAssemblyGFF3(assemblyName: string) {
  const stream = getAssemblyGFF3Stream(assemblyName)
  const fileName = `${assemblyName}.gff3`
  try {
    const handle = await (
      globalThis as unknown as {
        showSaveFilePicker: (opts: {
          suggestedName: string
        }) => Promise<FileSystemFileHandle>
      }
    ).showSaveFilePicker({ suggestedName: fileName })
    const writable = await handle.createWritable()
    await stream.pipeTo(writable)
  } catch {
    const blob = await new Response(stream).blob()
    saveAs(blob, fileName)
  }
}

async function* getFeaturesForAssembly(assemblyName: string) {
  const db = await openDb(assemblyName, [])
  for (const storeName of db.objectStoreNames) {
    const tx = db.transaction(storeName)
    for await (const cursor of tx.store.iterate()) {
      yield cursor.value
    }
  }
  db.close()
}
