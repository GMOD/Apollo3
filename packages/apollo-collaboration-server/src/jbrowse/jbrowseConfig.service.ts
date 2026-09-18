import fs from 'node:fs/promises'
import path from 'node:path'

import {
  BgzipIndexedFasta,
  FetchableSmallFasta,
  IndexedFasta,
} from '@gmod/indexedfasta'
import { TwoBitFile } from '@gmod/twobit'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  type GenericFilehandle,
  LocalFile,
  RemoteFile,
} from 'generic-filehandle2'

import { resolveJBrowseDir } from '../utils/jbrowse-dir.util.js'

export interface JBrowseUriLocation {
  uri: string
}

/** The subset of a JBrowse sequence adapter's interface Apollo actually uses. */
export interface SequenceAdapter {
  getSequence(
    name: string,
    start: number,
    end: number,
  ): Promise<string | undefined>
  getSequenceSizes(): Promise<Record<string, number>>
}

interface BgzipFastaAdapterConfig {
  type: 'BgzipFastaAdapter'
  /** Shorthand: derives fastaLocation/faiLocation/gziLocation from this uri, JBrowse-config-schema style. */
  uri?: string
  fastaLocation?: JBrowseUriLocation
  faiLocation?: JBrowseUriLocation
  gziLocation?: JBrowseUriLocation
}

interface IndexedFastaAdapterConfig {
  type: 'IndexedFastaAdapter'
  /** Shorthand: derives fastaLocation/faiLocation from this uri, JBrowse-config-schema style. */
  uri?: string
  fastaLocation?: JBrowseUriLocation
  faiLocation?: JBrowseUriLocation
}

interface TwoBitAdapterConfig {
  type: 'TwoBitAdapter'
  /** Shorthand: derives twoBitLocation from this uri, JBrowse-config-schema style. */
  uri?: string
  twoBitLocation?: JBrowseUriLocation
}

interface UnindexedFastaAdapterConfig {
  type: 'UnindexedFastaAdapter'
  /** Shorthand: derives fastaLocation from this uri, JBrowse-config-schema style. */
  uri?: string
  fastaLocation?: JBrowseUriLocation
}

interface FromConfigSequenceAdapterFeature {
  refName: string
  start: number
  end: number
  seq: string
}

interface FromConfigSequenceAdapterConfig {
  type: 'FromConfigSequenceAdapter'
  features: FromConfigSequenceAdapterFeature[]
}

export type JBrowseSequenceAdapterConfig =
  | BgzipFastaAdapterConfig
  | IndexedFastaAdapterConfig
  | TwoBitAdapterConfig
  | UnindexedFastaAdapterConfig
  | FromConfigSequenceAdapterConfig

export interface JBrowseSequenceConfig {
  adapter: JBrowseSequenceAdapterConfig
  metadata?: Record<string, unknown>
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
   * The config file served when none is specified: the first
   * JBROWSE_CONFIG_FILES entry, or "config.json" when that's unset.
   */
  getDefaultConfigFileName(): string {
    // getConfigFileNames() always returns a non-empty array.
    return this.getConfigFileNames()[0] ?? 'config.json'
  }

  /**
   * Security boundary for a client-driven request: maps a raw request path
   * (e.g. Express's `request.path`) onto one of the operator-declared config
   * filenames from `getConfigFileNames()` by exact match, after normalizing
   * percent-encoding and a leading slash. Returns undefined - never a
   * fallback - for anything not on the allowlist, so callers can tell "this
   * is one of our config files" apart from "this is something else" and
   * fall through (e.g. to static file serving) accordingly.
   *
   * Only this method's return value may be passed on to
   * `readJBrowseFileConfig` for a client-driven request - never pass a raw
   * client-supplied string there, since it gets joined into a filesystem
   * path or a dev-server fetch URL.
   */
  matchConfigFileName(requestPath: string): string | undefined {
    let decoded: string
    try {
      decoded = decodeURIComponent(requestPath)
    } catch {
      return undefined
    }
    const normalized = decoded.replace(/^\/+/, '')
    return this.getConfigFileNames().includes(normalized)
      ? normalized
      : undefined
  }

  /**
   * Reads one JBrowse config.json either off disk (JBROWSE_DIR, the
   * default) or, in the dev-only mode where a JBrowse dev server is running
   * instead of a built bundle on disk, by fetching it from that dev server
   * (JBROWSE_DEV_SERVER_URL). These two are mutually exclusive, enforced by
   * the Joi `.xor` in app.module.ts.
   */
  async readJBrowseFileConfig(
    fileName: string = this.getDefaultConfigFileName(),
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

  /**
   * Resolves a `sequence.adapter` location's `uri` to a filehandle. `uri` is
   * not guaranteed to be an absolute http(s) URL - disk-mode configs
   * (JBROWSE_DIR) commonly use paths relative to the *directory containing
   * the config.json that declared them* (JBrowse config-schema convention),
   * not to JBROWSE_DIR itself, and likewise dev-server-mode configs
   * (JBROWSE_DEV_SERVER_URL) use paths relative to that same directory on
   * the dev server. `configFileName` (e.g. "subdir/config.json") supplies
   * that base directory.
   */
  private resolveFileLocation(
    uri: string,
    configFileName: string,
  ): GenericFilehandle {
    if (/^https?:\/\//.test(uri)) {
      return new RemoteFile(uri, { fetch })
    }
    const configDir = path.posix.dirname(configFileName)
    const resolvedUri = configDir === '.' ? uri : `${configDir}/${uri}`
    const devServerUrl = this.configService.get('JBROWSE_DEV_SERVER_URL', {
      infer: true,
    })
    if (devServerUrl) {
      return new RemoteFile(new URL(resolvedUri, devServerUrl).href, {
        fetch,
      })
    }
    // Guaranteed to be set when JBROWSE_DEV_SERVER_URL isn't (enforced by
    // the Joi `.xor` in app.module.ts).
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const jbrowseDir = this.configService.get('JBROWSE_DIR', { infer: true })!
    return new LocalFile(path.join(resolveJBrowseDir(jbrowseDir), resolvedUri))
  }

  /**
   * Resolves a location that may be given either as the explicit
   * `{ <key>Location: { uri } }` form, or JBrowse's config-schema shorthand
   * of a bare top-level `uri` on the adapter, from which sibling index
   * files (e.g. `.fai`, `.gzi`) are conventionally derived by appending
   * `suffix`. Explicit locations always take precedence over the shorthand.
   */
  private static resolveShorthandLocation(
    explicit: JBrowseUriLocation | undefined,
    shorthandUri: string | undefined,
    suffix = '',
  ): JBrowseUriLocation | undefined {
    if (explicit) {
      return explicit
    }
    return shorthandUri ? { uri: `${shorthandUri}${suffix}` } : undefined
  }

  buildSequenceAdapter(
    assemblyName: string,
    sequence: JBrowseSequenceConfig,
    configFileName: string = this.getDefaultConfigFileName(),
  ): SequenceAdapter {
    const { adapter } = sequence
    switch (adapter.type) {
      case 'BgzipFastaAdapter': {
        const fastaLocation = JBrowseConfigService.resolveShorthandLocation(
          adapter.fastaLocation,
          adapter.uri,
        )
        const faiLocation = JBrowseConfigService.resolveShorthandLocation(
          adapter.faiLocation,
          adapter.uri,
          '.fai',
        )
        const gziLocation = JBrowseConfigService.resolveShorthandLocation(
          adapter.gziLocation,
          adapter.uri,
          '.gzi',
        )
        if (!fastaLocation || !faiLocation || !gziLocation) {
          throw new Error(
            `BgzipFastaAdapter config for assembly "${assemblyName}" is missing "uri" or "fastaLocation"/"faiLocation"/"gziLocation"`,
          )
        }
        return new BgzipIndexedFasta({
          fasta: this.resolveFileLocation(fastaLocation.uri, configFileName),
          fai: this.resolveFileLocation(faiLocation.uri, configFileName),
          gzi: this.resolveFileLocation(gziLocation.uri, configFileName),
        })
      }
      case 'IndexedFastaAdapter': {
        const fastaLocation = JBrowseConfigService.resolveShorthandLocation(
          adapter.fastaLocation,
          adapter.uri,
        )
        const faiLocation = JBrowseConfigService.resolveShorthandLocation(
          adapter.faiLocation,
          adapter.uri,
          '.fai',
        )
        if (!fastaLocation || !faiLocation) {
          throw new Error(
            `IndexedFastaAdapter config for assembly "${assemblyName}" is missing "uri" or "fastaLocation"/"faiLocation"`,
          )
        }
        return new IndexedFasta({
          fasta: this.resolveFileLocation(fastaLocation.uri, configFileName),
          fai: this.resolveFileLocation(faiLocation.uri, configFileName),
        })
      }
      case 'TwoBitAdapter': {
        const twoBitLocation = JBrowseConfigService.resolveShorthandLocation(
          adapter.twoBitLocation,
          adapter.uri,
        )
        if (!twoBitLocation) {
          throw new Error(
            `TwoBitAdapter config for assembly "${assemblyName}" is missing "uri" or "twoBitLocation"`,
          )
        }
        return new TwoBitFile({
          filehandle: this.resolveFileLocation(
            twoBitLocation.uri,
            configFileName,
          ),
        })
      }
      case 'UnindexedFastaAdapter': {
        const fastaLocation = JBrowseConfigService.resolveShorthandLocation(
          adapter.fastaLocation,
          adapter.uri,
        )
        if (!fastaLocation) {
          throw new Error(
            `UnindexedFastaAdapter config for assembly "${assemblyName}" is missing "uri" or "fastaLocation"`,
          )
        }
        return new UnindexedFastaSequenceAdapter(
          new FetchableSmallFasta({
            fasta: this.resolveFileLocation(fastaLocation.uri, configFileName),
          }),
        )
      }
      case 'FromConfigSequenceAdapter': {
        return new FromConfigSequenceAdapterImpl(adapter.features)
      }
      default: {
        // `adapter` here is typed as `never` because the switch above is
        // exhaustive over the *known* adapter types, but a config.json's
        // `adapter.type` is untrusted input parsed from JSON - it can be any
        // string at runtime, which is exactly the case this branch handles.
        throw new Error(
          `Unsupported sequence adapter type "${(adapter as { type: string }).type}" for assembly "${assemblyName}" in config.json`,
        )
      }
    }
  }

  /**
   * Builds the sequence adapter for an assembly by looking its
   * `sequence.adapter` config up by name within the one config.json it was
   * loaded from (`configId`, the Assembly document's own `configId` field -
   * a trusted, DB-stored value, not client input, so it's fine to pass
   * straight to `readJBrowseFileConfig` without going through
   * `matchConfigFileName`). JBrowse only guarantees `name` is unique within
   * a single config file, so this must never search across files - two
   * different files can define same-named assemblies with different
   * sequence data.
   */
  async getSequenceAdapterForAssembly(
    assemblyName: string,
    configId: string,
  ): Promise<SequenceAdapter> {
    const config = await this.readJBrowseFileConfig(configId)
    const assemblyConfig = (config.assemblies ?? []).find(
      (candidate) => candidate.name === assemblyName,
    )
    if (!assemblyConfig) {
      throw new Error(
        `Assembly "${assemblyName}" not found in configured config.json file "${configId}"`,
      )
    }
    return this.buildSequenceAdapter(
      assemblyName,
      assemblyConfig.sequence,
      configId,
    )
  }
}

/**
 * Adapts `@gmod/indexedfasta`'s `FetchableSmallFasta` (an unindexed,
 * whole-file-in-memory FASTA reader) to the `SequenceAdapter` interface.
 *
 * This deliberately does not call `FetchableSmallFasta.fetch()`: as of
 * @gmod/indexedfasta 5.0.2, it does `entry.sequence.slice(start, end - start)`
 * instead of `slice(start, end)`, i.e. it treats its second argument as a
 * length rather than an end offset. For any `start > 0` this silently
 * returns a truncated (and wrongly-positioned) substring instead of
 * throwing, which is worse than just being wrong - it looks like valid
 * sequence data. Slicing `entry.sequence` directly here sidesteps the bug.
 */
class UnindexedFastaSequenceAdapter implements SequenceAdapter {
  constructor(private readonly fasta: FetchableSmallFasta) {}

  async getSequence(
    name: string,
    start: number,
    end: number,
  ): Promise<string | undefined> {
    const data = await this.fasta.data
    const entry = data.find((candidate) => candidate.id === name)
    return entry?.sequence.slice(start, end)
  }

  async getSequenceSizes(): Promise<Record<string, number>> {
    const entries = await this.fasta.data
    return Object.fromEntries(
      entries.map((entry) => [entry.id, entry.sequence.length]),
    )
  }
}

/**
 * Reads a `FromConfigSequenceAdapter`'s bases directly out of `config.json`
 * (no file I/O), grouping its inlined `features` by `refName`. Intended for
 * Apollo's own small/demo/test assemblies, matching how JBrowse itself uses
 * this adapter type.
 */
class FromConfigSequenceAdapterImpl implements SequenceAdapter {
  private readonly featuresByRefName = new Map<
    string,
    FromConfigSequenceAdapterFeature[]
  >()

  constructor(features: FromConfigSequenceAdapterFeature[]) {
    for (const feature of features) {
      const existing = this.featuresByRefName.get(feature.refName)
      if (existing) {
        existing.push(feature)
      } else {
        this.featuresByRefName.set(feature.refName, [feature])
      }
    }
    for (const features of this.featuresByRefName.values()) {
      features.sort((a, b) => a.start - b.start)
    }
  }

  getSequence(
    name: string,
    start: number,
    end: number,
  ): Promise<string | undefined> {
    const features = this.featuresByRefName.get(name)
    let sequence: string | undefined
    if (features) {
      sequence = ''
      for (const feature of features) {
        const overlapStart = Math.max(start, feature.start)
        const overlapEnd = Math.min(end, feature.end)
        if (overlapStart < overlapEnd) {
          sequence += feature.seq.slice(
            overlapStart - feature.start,
            overlapEnd - feature.start,
          )
        }
      }
    }
    return Promise.resolve(sequence)
  }

  getSequenceSizes(): Promise<Record<string, number>> {
    return Promise.resolve(
      Object.fromEntries(
        [...this.featuresByRefName].map(([refName, features]) => [
          refName,
          Math.max(...features.map((feature) => feature.end)),
        ]),
      ),
    )
  }
}
