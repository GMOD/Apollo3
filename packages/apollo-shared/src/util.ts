/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { AnnotationFeatureSnapshot } from '@apollo-annotation/mst'
import { GFF3Feature } from '@gmod/gff'

import fs from 'node:fs'

import { Buffer } from 'node:buffer'
import { promisify } from 'node:util'
import { GenericFilehandle, FilehandleOptions, Stats } from 'generic-filehandle'
import { FileHandle } from 'node:fs/promises'
import { gunzip } from 'node:zlib'

export class LocalFileGzip implements GenericFilehandle {
  private fileHandle: Promise<FileHandle> | undefined
  private filename: string
  private opts: FilehandleOptions

  public constructor(source: string, opts: FilehandleOptions = {}) {
    this.filename = source
    this.opts = opts
  }

  private getFileHandle(): Promise<FileHandle> {
    if (!this.fileHandle) {
      this.fileHandle = fs.promises.open(this.filename)
    }
    return this.fileHandle
  }

  public async read(
    buffer: Buffer,
    offset = 0,
    length: number,
    position = 0,
  ): Promise<{ bytesRead: number; buffer: Buffer }> {
    const fileHandle = await this.getFileHandle()
    const unzippedContents = await unzip(fileHandle)
    const bytesRead = unzippedContents.copy(
      buffer,
      position,
      offset,
      offset + length,
    )
    return { bytesRead, buffer }
  }

  public async readFile(): Promise<Buffer>
  public async readFile(options: BufferEncoding): Promise<string>
  public async readFile<T extends undefined>(
    options:
      | Omit<FilehandleOptions, 'encoding'>
      | (Omit<FilehandleOptions, 'encoding'> & { encoding: T }),
  ): Promise<Buffer>
  public async readFile<T extends BufferEncoding>(
    options: Omit<FilehandleOptions, 'encoding'> & { encoding: T },
  ): Promise<string>

  public async readFile(
    _options?: FilehandleOptions | BufferEncoding,
  ): Promise<Buffer | string> {
    const fileHandle = await this.getFileHandle()
    const unzippedContents = await unzip(fileHandle)
    if (this.opts.encoding) {
      console.log(`IN: ${this.filename}`)
      return unzippedContents.toString(this.opts.encoding)
    }
    console.log(`OUT: ${this.filename}`)
    return unzippedContents
  }

  // todo memoize
  public async stat(): Promise<Stats> {
    const fh = await this.getFileHandle()
    return fh.stat()
  }

  public async close(): Promise<void> {
    const fh = await this.getFileHandle()
    return fh.close()
  }
}

async function unzip(input: FileHandle): Promise<Buffer> {
  const gunzipP = promisify(gunzip)
  const fileContents = await input.readFile()
  const unzippedContents = await gunzipP(fileContents)
  return unzippedContents
}

export function makeGFF3Feature(
  feature: AnnotationFeatureSnapshot,
  parentId?: string,
  refSeqNames?: Record<string, string | undefined>,
): GFF3Feature {
  const locations = [{ start: feature.min, end: feature.max }]
  // const locations = feature.discontinuousLocations?.length
  //   ? feature.discontinuousLocations
  //   : [{ start: feature.start, end: feature.end, phase: feature.phase }]
  const attributes: Record<string, string[] | undefined> = JSON.parse(
    JSON.stringify(feature.attributes),
  )
  const ontologyTerms: string[] = []
  const source = feature.attributes?.source?.[0] ?? null
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
  if (ontologyTerms.length > 0) {
    attributes.Ontology_term = ontologyTerms
  }
  return locations.map((location) => ({
    start: location.start + 1,
    end: location.end,
    seq_id: refSeqNames ? refSeqNames[feature.refSeq] ?? null : feature.refSeq,
    source,
    type: feature.type,
    score: null,
    // score: feature.score ?? null,
    strand: feature.strand ? (feature.strand === 1 ? '+' : '-') : null,
    phase: null,
    // phase:
    //   location.phase === 0
    //     ? '0'
    //     : location.phase === 1
    //       ? '1'
    //       : location.phase === 2
    //         ? '2'
    //         : null,
    attributes: Object.keys(attributes).length > 0 ? attributes : null,
    derived_features: [],
    child_features: feature.children
      ? Object.values(feature.children).map((child) =>
          makeGFF3Feature(child, attributes.ID?.[0], refSeqNames),
        )
      : [],
  }))
}

export function splitStringIntoChunks(
  input: string,
  chunkSize: number,
): string[] {
  const chunks: string[] = []
  for (let i = 0; i < input.length; i += chunkSize) {
    const chunk = input.slice(i, i + chunkSize)
    chunks.push(chunk)
  }
  return chunks
}
