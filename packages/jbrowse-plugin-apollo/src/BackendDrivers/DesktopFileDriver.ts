/* eslint-disable @typescript-eslint/require-await */
import {
  type AssemblySpecificChange,
  type Change,
  isAssemblySpecificChange,
} from '@apollo-annotation/common'
import {
  type AnnotationFeatureSnapshot,
  type CheckResultSnapshot,
} from '@apollo-annotation/mst'
import {
  ValidationResultSet,
  annotationFeatureToGFF3,
  splitStringIntoChunks,
} from '@apollo-annotation/shared'
import gff, { type GFF3Item } from '@gmod/gff'
import { getConf } from '@jbrowse/core/configuration'
import { type Region, getSession } from '@jbrowse/core/util'
import { getSnapshot } from 'mobx-state-tree'

import { checkFeatures, loadAssemblyIntoClient } from '../util'

import { BackendDriver, type RefNameAliases } from './BackendDriver'

export class DesktopFileDriver extends BackendDriver {
  async loadAssembly(assemblyName: string) {
    const { assemblyManager } = getSession(this.clientStore)
    const assembly = assemblyManager.get(assemblyName)
    if (!assembly) {
      throw new Error(`Assembly ${assemblyName} not found`)
    }
    const { file } = getConf(assembly, ['sequence', 'metadata']) as {
      file: string
    }

    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/consistent-type-imports
    const fs = require('node:fs') as typeof import('fs')
    const fileContents = await fs.promises.readFile(file, 'utf8')
    return loadAssemblyIntoClient(assemblyName, fileContents, this.clientStore)
  }

  async getAssembly(assemblyName: string) {
    let assembly = this.clientStore.assemblies.get(assemblyName)
    if (!assembly) {
      assembly = await this.loadAssembly(assemblyName)
    }
    return assembly
  }

  async getRefNameAliases(assemblyName: string): Promise<RefNameAliases[]> {
    const assembly = await this.getAssembly(assemblyName)
    const refNameAliases: RefNameAliases[] = []
    for (const [, refSeq] of assembly.refSeqs) {
      refNameAliases.push({
        refName: refSeq.name,
        aliases: [refSeq._id],
        uniqueId: `alias-${refSeq._id}`,
      })
    }
    return refNameAliases
  }

  async getFeatures(
    region: Region,
  ): Promise<[AnnotationFeatureSnapshot[], CheckResultSnapshot[]]> {
    await this.getAssembly(region.assemblyName)
    return [[], []]
  }

  async getSequence(region: Region) {
    const { assemblyName, end, refName, start } = region
    const assembly = await this.getAssembly(assemblyName)
    const refSeq = assembly.refSeqs.get(refName)
    if (!refSeq) {
      throw new Error(`refSeq ${refName} not found in client data store`)
    }
    const seq = refSeq.getSequence(start, end)
    return { seq, refSeq: refName }
  }

  async getRegions(assemblyName: string): Promise<Region[]> {
    const assembly = await this.getAssembly(assemblyName)
    const regions: Region[] = []
    for (const [, refSeq] of assembly.refSeqs) {
      regions.push({
        assemblyName,
        refName: refSeq.name,
        start: refSeq.sequence[0].start,
        end: refSeq.sequence[0].stop,
      })
    }
    return regions
  }

  getAssemblies() {
    const { assemblyManager } = getSession(this.clientStore)
    return assemblyManager.assemblies.filter((assembly) => {
      const sequenceMetadata = getConf(assembly, ['sequence', 'metadata']) as
        | { apollo: boolean; internetAccountConfigId?: string; file?: string }
        | undefined
      return Boolean(
        sequenceMetadata &&
          sequenceMetadata.apollo &&
          !sequenceMetadata.internetAccountConfigId &&
          sequenceMetadata.file,
      )
    })
  }

  async submitChange(change: Change | AssemblySpecificChange) {
    if (!isAssemblySpecificChange(change)) {
      throw new Error(
        `Cannot use this type of change with local file: "${change.typeName}"`,
      )
    }
    const { assemblyManager } = getSession(this.clientStore)
    const assembly = assemblyManager.get(change.assembly)
    if (!assembly) {
      throw new Error(`Could not find assembly with name "${change.assembly}"`)
    }
    const { file } = getConf(assembly, ['sequence', 'metadata']) as {
      file: string
    }
    const clientAssembly = this.clientStore.assemblies.get(change.assembly)
    if (!clientAssembly) {
      throw new Error(
        `Could not find assembly in client with name "${change.assembly}"`,
      )
    }
    const refSeqs = new Set(...clientAssembly.refSeqs.keys())
    const { checkResults } = this.clientStore
    for (const checkResult of checkResults.values()) {
      if (refSeqs.has(checkResult.refSeq)) {
        checkResults.delete(checkResult._id)
      }
    }
    const newCheckResults = await checkFeatures(clientAssembly)
    this.clientStore.addCheckResults(newCheckResults)
    const gff3Items: GFF3Item[] = [{ directive: 'gff-version', value: '3' }]
    for (const [, refSeq] of clientAssembly.refSeqs) {
      gff3Items.push({
        directive: 'sequence-region',
        value: `${refSeq.name} 1 ${refSeq.sequence[0].stop}`,
      })
    }
    for (const comment of clientAssembly.comments) {
      gff3Items.push({ comment })
    }
    for (const [, refSeq] of clientAssembly.refSeqs) {
      const { features } = refSeq
      for (const [, feature] of features) {
        gff3Items.push(annotationFeatureToGFF3(getSnapshot(feature)))
      }
    }
    for (const [, refSeq] of clientAssembly.refSeqs) {
      const [sequence] = refSeq.sequence
      const formattedSequence = splitStringIntoChunks(
        sequence.sequence,
        80,
      ).join('\n')
      gff3Items.push({
        id: refSeq.name,
        description: refSeq.description,
        sequence: formattedSequence,
      })
    }

    const gff3Contents = gff.formatSync(gff3Items)

    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/consistent-type-imports
    const fs = require('node:fs') as typeof import('fs')
    await fs.promises.writeFile(file, gff3Contents, 'utf8')

    const results = new ValidationResultSet()
    return results
  }

  async searchFeatures(
    _term: string,
    _assemblies: string[],
  ): Promise<AnnotationFeatureSnapshot[]> {
    return []
  }
}
