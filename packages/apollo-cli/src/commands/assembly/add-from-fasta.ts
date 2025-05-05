/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import * as fs from 'node:fs'
import path from 'node:path'

import {
  SerializedAddAssemblyFromExternalChange,
  SerializedAddAssemblyFromFileChange,
} from '@apollo-annotation/shared'
import { Args, Flags } from '@oclif/core'
import { ObjectId } from 'bson'
import { Response } from 'undici'

import { FileCommand } from '../../fileCommand.js'
import { queryApollo, submitAssembly } from '../../utils.js'

export default class AddFasta extends FileCommand {
  static summary = 'Add a new assembly from fasta input'
  static description = `Add new assembly. The input fasta may be:
    * A local file bgzip'd and indexed. It can be uncompressed if the -e/--editable is set (but see description of -e)
    * An external fasta file bgzip'd and indexed
    * The id of a file previously uploaded to Apollo`

  static examples = [
    {
      description:
        'From local file assuming indexes genome.gz.fai and genome.gz.gzi are present:',
      command: '<%= config.bin %> <%= command.id %> genome.fa.gz -a myAssembly',
    },
    {
      description:
        'Local file with editable sequence does not require compression and indexing:',
      command: '<%= config.bin %> <%= command.id %> genome.fa -a myAssembly',
    },
    {
      description:
        'From external source assuming there are also indexes https://.../genome.fa.gz.fai and https://.../genome.fa.gz.gzi:',
      command:
        '<%= config.bin %> <%= command.id %> https://.../genome.fa.gz -a myAssembly',
    },
  ]

  static args = {
    input: Args.string({
      description:
        "Input fasta file, local or remote, or id of a previously uploaded \
file. For local or remote files, it is assumed the file is bgzip'd with \
`bgzip` and indexed with `samtools faidx`. The indexes are assumed to be at \
<my.fasta.gz>.fai and <my.fasta.gz>.gzi unless the options --fai and --gzi are \
provided. A local file can be uncompressed if the flag -e/--editable is set (but see below about using -e)",
      required: true,
    }),
  }

  static flags = {
    assembly: Flags.string({
      char: 'a',
      description: 'Name for this assembly. Use the file name if omitted',
    }),
    force: Flags.boolean({
      char: 'f',
      description: 'Delete existing assembly, if it exists',
    }),
    editable: Flags.boolean({
      char: 'e',
      description:
        'Instead of using indexed fasta lookup, the sequence is loaded into \
the Apollo database and is editable. Use with caution, as editing the sequence \
often has unintended side effects.',
    }),
    fai: Flags.string({
      description: 'Fasta index of the (not-editable) fasta file',
    }),
    gzi: Flags.string({
      description: 'Gzi index of the (not-editable) fasta file',
    }),
    gzip: Flags.boolean({
      char: 'z',
      description:
        'For local file input: Override autodetection and instruct that input is gzip compressed',
      exclusive: ['decompressed'],
    }),
    decompressed: Flags.boolean({
      char: 'd',
      description:
        'For local file input: Override autodetection and instruct that input is decompressed',
      exclusive: ['gzip'],
    }),
  }

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(AddFasta)

    const access = await this.getAccess()

    const assemblyName = flags.assembly ?? path.basename(args.input)

    const fastaIsFileId = await isFileId(
      args.input,
      access.address,
      access.accessToken,
    )
    const isExternal = isValidHttpUrl(args.input)

    let body:
      | SerializedAddAssemblyFromFileChange
      | SerializedAddAssemblyFromExternalChange
    if (isExternal) {
      if (flags.editable) {
        this.error(
          `External fasta files are not editable. The -e/--editable has been set with an external input file.`,
        )
      }
      const fai = flags.fai ?? `${args.input}.fai`
      const faiExists = await fetch(fai)
      if (!faiExists.ok) {
        this.error(`Index file ${fai} does not exist`)
      }
      const gzi = flags.gzi ?? `${args.input}.gzi`
      const gziExists = await fetch(gzi)
      if (!gziExists.ok) {
        this.error(`Index file ${gzi} does not exist`)
      }
      body = {
        assemblyName,
        typeName: 'AddAssemblyFromExternalChange',
        externalLocation: { fa: args.input, fai, gzi },
        assembly: new ObjectId().toHexString(),
      }
    } else if (flags.editable) {
      if (!isExternal && !fs.existsSync(args.input) && !fastaIsFileId) {
        this.error(`Input "${args.input}" is not valid`)
      }
      let isGzip = args.input.endsWith('.gz')
      if (flags.gzip) {
        isGzip = true
      }
      if (flags.decompressed) {
        isGzip = false
      }

      const fileId = fastaIsFileId
        ? args.input
        : await this.uploadFile(
            access.address,
            access.accessToken,
            args.input,
            'text/x-fasta',
            isGzip,
          )
      body = {
        assemblyName,
        fileIds: { fa: fileId },
        typeName: 'AddAssemblyFromFileChange',
        assembly: new ObjectId().toHexString(),
      }
    } else {
      const gzi = flags.gzi ?? `${args.input}.gzi`
      const fai = flags.fai ?? `${args.input}.fai`

      const gziIsFileId = await isFileId(
        gzi,
        access.address,
        access.accessToken,
      )
      const faiIsFileId = await isFileId(
        fai,
        access.address,
        access.accessToken,
      )

      if (!fs.existsSync(gzi) && !gziIsFileId && !flags.editable) {
        this.error(
          `Only bgzip'd and indexed fasta files are supported unless option -e/--editable is set. "${gzi}" is neither a file or a file id`,
        )
      }
      if (!fs.existsSync(fai) && !faiIsFileId) {
        this.error(
          `Only bgzip'd and indexed fasta files are supported at the moment. "${fai}" is neither a file or a file id`,
        )
      }

      const faId = fastaIsFileId
        ? args.input
        : await this.uploadFile(
            access.address,
            access.accessToken,
            args.input,
            'application/x-bgzip-fasta',
            true,
          )

      const faiId = faiIsFileId
        ? fai
        : await this.uploadFile(
            access.address,
            access.accessToken,
            fai,
            'text/x-fai',
            false,
          )

      const gziId = gziIsFileId
        ? gzi
        : await this.uploadFile(
            access.address,
            access.accessToken,
            gzi,
            'application/x-gzi',
            false,
          )

      body = {
        assemblyName,
        typeName: 'AddAssemblyFromFileChange',
        fileIds: { fa: faId, fai: faiId, gzi: gziId },
        assembly: new ObjectId().toHexString(),
      }
    }
    const rec = await submitAssembly(
      access.address,
      access.accessToken,
      body,
      flags.force,
    )
    this.log(JSON.stringify(rec, null, 2))
  }
}

function isValidHttpUrl(x: string) {
  let url
  try {
    url = new URL(x)
  } catch {
    return false
  }
  return url.protocol === 'http:' || url.protocol === 'https:'
}

async function isFileId(x: string, address: string, accessToken: string) {
  if (x.length != 24) {
    return false
  }
  const files: Response = await queryApollo(address, accessToken, 'files')
  const json = (await files.json()) as object[]
  for (const fileDoc of json) {
    if (fileDoc['_id' as keyof typeof fileDoc] === x) {
      return true
    }
  }
  return false
}
