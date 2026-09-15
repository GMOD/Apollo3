import fs from 'node:fs/promises'
import path from 'node:path'

import { BgzipIndexedFasta } from '@gmod/indexedfasta'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { RemoteFile } from 'generic-filehandle2'

import { resolveJBrowseDir } from '../utils/jbrowse-dir.util.js'

export interface JBrowseUriLocation {
  uri: string
}

export interface JBrowseSequenceConfig {
  adapter: {
    type: string
    fastaLocation: JBrowseUriLocation
    faiLocation: JBrowseUriLocation
    gziLocation: JBrowseUriLocation
  }
}

export interface JBrowseAssemblyConfig {
  name: string
  sequence: JBrowseSequenceConfig
}

export interface JBrowseFileConfig {
  assemblies?: JBrowseAssemblyConfig[]
  tracks?: Record<string, unknown>[]
  internetAccounts?: Record<string, unknown>[]
  [key: string]: unknown
}

/**
 * Reads the JBrowse config.json and resolves per-assembly sequence
 * adapters from it. This is the sole source of assembly sequence data
 * (Assembly documents no longer carry their own fileIds/externalLocation),
 * so JBrowseService, SequenceService, and ExportService all depend on this
 * service rather than on each other, to avoid a module dependency cycle.
 */
@Injectable()
export class JBrowseConfigService {
  constructor(
    private readonly configService: ConfigService<
      {
        JBROWSE_DIR?: string
        JBROWSE_DEV_SERVER_URL?: string
      },
      true
    >,
  ) {}

  /**
   * Reads the JBrowse config.json either off disk (JBROWSE_DIR, the
   * default) or, in the dev-only mode where a JBrowse dev server is running
   * instead of a built bundle on disk, by fetching it from that dev server
   * (JBROWSE_DEV_SERVER_URL). These two are mutually exclusive, enforced by
   * the Joi `.xor` in app.module.ts.
   */
  async readJBrowseFileConfig(): Promise<JBrowseFileConfig> {
    const devServerUrl = this.configService.get('JBROWSE_DEV_SERVER_URL', {
      infer: true,
    })
    if (devServerUrl) {
      const response = await fetch(new URL('config.json', devServerUrl))
      if (!response.ok) {
        throw new Error(
          `Failed to fetch config.json from JBrowse dev server at "${devServerUrl}": ${response.status} ${response.statusText}`,
        )
      }
      return (await response.json()) as JBrowseFileConfig
    }
    // Guaranteed to be set when JBROWSE_DEV_SERVER_URL isn't (enforced by
    // the Joi `.xor` in app.module.ts).
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const jbrowseDir = this.configService.get('JBROWSE_DIR', { infer: true })!
    const configPath = path.join(resolveJBrowseDir(jbrowseDir), 'config.json')
    const contents = await fs.readFile(configPath, 'utf8')
    return JSON.parse(contents) as JBrowseFileConfig
  }

  buildSequenceAdapter(
    assemblyName: string,
    sequence: JBrowseSequenceConfig,
  ): BgzipIndexedFasta {
    const { adapter } = sequence
    if (adapter.type !== 'BgzipFastaAdapter') {
      throw new Error(
        `Unsupported sequence adapter type "${adapter.type}" for assembly "${assemblyName}" in config.json`,
      )
    }
    return new BgzipIndexedFasta({
      fasta: new RemoteFile(adapter.fastaLocation.uri, { fetch }),
      fai: new RemoteFile(adapter.faiLocation.uri, { fetch }),
      gzi: new RemoteFile(adapter.gziLocation.uri, { fetch }),
    })
  }

  /**
   * Builds the sequence adapter for an assembly by looking its
   * `sequence.adapter` config up in config.json by name.
   */
  async getSequenceAdapterForAssembly(
    assemblyName: string,
  ): Promise<BgzipIndexedFasta> {
    const config = await this.readJBrowseFileConfig()
    const assemblyConfig = (config.assemblies ?? []).find(
      (candidate) => candidate.name === assemblyName,
    )
    if (!assemblyConfig) {
      throw new Error(`Assembly "${assemblyName}" not found in config.json`)
    }
    return this.buildSequenceAdapter(assemblyName, assemblyConfig.sequence)
  }
}
