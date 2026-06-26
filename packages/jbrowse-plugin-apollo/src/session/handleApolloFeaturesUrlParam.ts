import type { AnnotationFeatureSnapshot } from '@apollo-annotation/mst'
import { AddFeatureChange } from '@apollo-annotation/shared'
import type { AbstractSessionModel } from '@jbrowse/core/util'
import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import equal from 'fast-deep-equal/es6'

import { LocalDriver } from '../BackendDrivers'
import { openDb } from '../BackendDrivers/LocalDriver/db'
import { DuplicateFeatureDialog } from '../components/DuplicateFeatureDialog'

import type { ClientDataStoreModel } from './ClientDataStore'

export function toUrlSafeBase64(base64: string) {
  return base64
    .replaceAll('+', '-') // Replace + with -
    .replaceAll('/', '_') // Replace / with _
    .replace(/=+$/, '') // Remove padding characters
}

export function fromUrlSafeBase64(urlSafeBase64: string) {
  let base64 = urlSafeBase64.replaceAll('-', '+').replaceAll('_', '/')
  const pad = base64.length % 4
  if (pad) {
    base64 += '='.repeat(4 - pad)
  }
  return base64
}

export async function compress(data: unknown) {
  const json = JSON.stringify(data)
  const bytes = new TextEncoder().encode(json)
  const stream = new Blob([bytes]).stream()
  const compressionStream = new CompressionStream('gzip')
  const compressedStream = stream.pipeThrough(compressionStream)
  const response = new Response(compressedStream)
  const compressed = await response.arrayBuffer()
  // eslint-disable-next-line unicorn/prefer-code-point
  return btoa(String.fromCharCode(...new Uint8Array(compressed)))
}

// Base64 decode + decompress
export async function decompress(encoded: string): Promise<unknown> {
  const binaryString = atob(encoded)
  // eslint-disable-next-line unicorn/prefer-code-point
  const bytes = Uint8Array.from(binaryString, (char) => char.charCodeAt(0))
  const stream = new Blob([bytes]).stream()
  const decompressionStream = new DecompressionStream('gzip')
  const decompressedStream = stream.pipeThrough(decompressionStream)
  const response = new Response(decompressedStream)
  const decompressed = await response.arrayBuffer()
  return JSON.parse(new TextDecoder().decode(decompressed))
}

export async function handleApolloFeaturesUrlParam(
  encodedFeatures: string,
  apolloDataStore: ClientDataStoreModel,
  assemblyManager: AbstractSessionModel['assemblyManager'],
  session: AbstractSessionModel,
): Promise<void> {
  const base64 = fromUrlSafeBase64(encodedFeatures)
  const decompressed = await decompress(base64)
  const featuresData = decompressed as Record<
    string,
    AnnotationFeatureSnapshot[]
  >
  for (const [assemblyName, featureSnapshots] of Object.entries(featuresData)) {
    const backendDriver = apolloDataStore.getBackendDriver(assemblyName)
    if (!(backendDriver instanceof LocalDriver)) {
      continue
    }
    const assembly = (await assemblyManager.waitForAssembly(assemblyName)) as
      | Assembly
      | undefined
    if (!assembly) {
      throw new Error(`Assembly not found: "${assemblyName}"`)
    }
    const { regions } = assembly
    if (!regions) {
      throw new Error(`Assembly not found: "${assemblyName}"`)
    }
    const refNames = regions.map((r) => r.refName)
    const db = await openDb(assemblyName, refNames)
    for (const featureSnapshot of featureSnapshots) {
      const storeName = `features-${featureSnapshot.refSeq}`
      const existing = (await db.get(storeName, featureSnapshot._id)) as
        | AnnotationFeatureSnapshot
        | undefined
      // get rid of undefined values in JSON
      // eslint-disable-next-line unicorn/prefer-structured-clone
      const existingFeature = JSON.parse(
        JSON.stringify(existing),
      ) as AnnotationFeatureSnapshot
      if (existing === undefined) {
        const change = new AddFeatureChange({
          typeName: 'AddFeatureChange',
          assembly: assemblyName,
          changedIds: [featureSnapshot._id],
          addedFeature: featureSnapshot,
        })
        await apolloDataStore.changeManager.submit(change)
      } else if (!equal(featureSnapshot, existingFeature)) {
        await new Promise<void>((resolve) => {
          session.queueDialog((doneCallback) => [
            DuplicateFeatureDialog,
            {
              featureSnapshot,
              existingFeature,
              assemblyName,
              changeManager: apolloDataStore.changeManager,
              handleClose: () => {
                doneCallback()
                resolve()
              },
            },
          ])
        })
      }
    }
  }
}
