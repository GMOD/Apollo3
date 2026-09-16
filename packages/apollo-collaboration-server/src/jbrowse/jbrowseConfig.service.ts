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
        JBROWSE_CONFIG_FILES?: string
      },
      true
    >,
  ) {}

  /**
   * Parses JBROWSE_CONFIG_FILES into the allowlist of config.json filenames
   * this server can serve, in declared order. The first entry is the
   * default used when no `configId` is requested, or an unrecognized one
   * is. Defaults to `['config.json']` when unset, preserving the
   * single-config behavior of a server that hasn't opted into this
   * feature.
   */
  getConfigFileNames(): string[] {
    const raw = this.configService.get('JBROWSE_CONFIG_FILES', {
      infer: true,
    })
    if (!raw) {
      return ['config.json']
    }
    const fileNames = raw
      .split(',')
      .map((fileName) => fileName.trim())
      .filter(Boolean)
    return fileNames.length > 0 ? fileNames : ['config.json']
  }

  /**
   * Validates a client-requested config filename (the `configId` query
   * param) against the operator-declared allowlist from
   * `getConfigFileNames()`, falling back to the default (first entry) when
   * `requested` is undefined or not in the list.
   *
   * This is a security boundary: `requested` is untrusted client input, so
   * only the return value of this method may be passed on to
   * `readJBrowseFileConfig` for a client-driven request - never pass a raw
   * client-supplied string there, since it gets joined into a filesystem
   * path or a dev-server fetch URL.
   */
  resolveConfigFileName(requested?: string): string {
    const fileNames = this.getConfigFileNames()
    if (requested && fileNames.includes(requested)) {
      return requested
    }
    // getConfigFileNames() always returns a non-empty array.
    return fileNames[0] ?? 'config.json'
  }

  /**
   * Reads one JBrowse config.json either off disk (JBROWSE_DIR, the
   * default) or, in the dev-only mode where a JBrowse dev server is running
   * instead of a built bundle on disk, by fetching it from that dev server
   * (JBROWSE_DEV_SERVER_URL). These two are mutually exclusive, enforced by
   * the Joi `.xor` in app.module.ts.
   */
  async readJBrowseFileConfig(
    fileName: string = this.resolveConfigFileName(),
  ): Promise<JBrowseFileConfig> {
    const devServerUrl = this.configService.get('JBROWSE_DEV_SERVER_URL', {
      infer: true,
    })
    if (devServerUrl) {
      const response = await fetch(new URL(fileName, devServerUrl))
      if (!response.ok) {
        throw new Error(
          `Failed to fetch ${fileName} from JBrowse dev server at "${devServerUrl}": ${response.status} ${response.statusText}`,
        )
      }
      return (await response.json()) as JBrowseFileConfig
    }
    // Guaranteed to be set when JBROWSE_DEV_SERVER_URL isn't (enforced by
    // the Joi `.xor` in app.module.ts).
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const jbrowseDir = this.configService.get('JBROWSE_DIR', { infer: true })!
    const configPath = path.join(resolveJBrowseDir(jbrowseDir), fileName)
    const contents = await fs.readFile(configPath, 'utf8')
    return JSON.parse(contents) as JBrowseFileConfig
  }

  /**
   * Reads every configured config.json (per JBROWSE_CONFIG_FILES), keyed by
   * filename, in declared order. Used at startup to seed Mongo from all of
   * them regardless of which one a user later requests.
   */
  async readAllJBrowseFileConfigs(): Promise<Map<string, JBrowseFileConfig>> {
    const configs = new Map<string, JBrowseFileConfig>()
    for (const fileName of this.getConfigFileNames()) {
      configs.set(fileName, await this.readJBrowseFileConfig(fileName))
    }
    return configs
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
   * `sequence.adapter` config up by name across every configured
   * config.json (JBROWSE_CONFIG_FILES), in declared order, first match
   * wins. Callers here only have an assembly name, not a "which config
   * file is this session using" context, so this can't be scoped the way
   * JBrowseService.getTracks() is.
   */
  async getSequenceAdapterForAssembly(
    assemblyName: string,
  ): Promise<BgzipIndexedFasta> {
    const fileNames = this.getConfigFileNames()
    for (const fileName of fileNames) {
      const config = await this.readJBrowseFileConfig(fileName)
      const assemblyConfig = (config.assemblies ?? []).find(
        (candidate) => candidate.name === assemblyName,
      )
      if (assemblyConfig) {
        return this.buildSequenceAdapter(assemblyName, assemblyConfig.sequence)
      }
    }
    throw new Error(
      `Assembly "${assemblyName}" not found in any of the configured config.json files (${fileNames.join(', ')})`,
    )
  }
}
