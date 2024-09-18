/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { Args, Flags } from '@oclif/core'
import { ObjectId } from 'bson'

import { FileCommand } from '../../fileCommand.js'
import { queryApollo, submitAssembly } from '../../utils.js'
import { Response } from 'undici'

export default class AddFasta extends FileCommand {
  static description = `Add new assembly from a fasta file. The input file may be:
    * A local file 
    * An external fasta file
    * The id of a file previously uploaded to Apollo`

  static examples = [
    {
      description: 'From local file:',
      command: '<%= config.bin %> <%= command.id %> genome.fa -a myAssembly',
    },
    {
      description: 'From external source we also need the URL of the index:',
      command:
        '<%= config.bin %> <%= command.id %> https://.../genome.fa -x https://.../genome.fa.fai -a myAssembly',
    },
  ]

  static args = {
    'input-file': Args.string({
      description:
        'Input fasta file, local or remote, or id of a previously uploaded file',
      required: true,
    }),
  }

  static flags = {
    assembly: Flags.string({
      char: 'a',
      description: 'Name for this assembly. Use the file name if omitted',
    }),
    index: Flags.string({
      char: 'x',
      description: 'URL of the index. Required if input is an external source',
    }),
    force: Flags.boolean({
      char: 'f',
      description: 'Delete existing assembly, if it exists',
    }),
    'not-editable': Flags.boolean({
      char: 'n',
      description:
        "The fasta sequence is not editable. Apollo will not load it into \
the database and instead use the provided indexes to query it. This option assumes \
the fasta file is bgzip'd with `bgzip` and indexed with `samtools faidx`. \
Indexes should be named <my.fasta.gz>.gzi and <my.fasta.gz>.fai unless options --fai and --gzi are set",
    }),
    fai: Flags.string({
      description: 'Fasta index of the (not-editable) fasta file',
    }),
    gzi: Flags.string({
      description: 'Gzi index of the (not-editable) fasta file',
    }),
  }

  public async run(): Promise<void> {
    const { args } = await this.parse(AddFasta)
    const { flags } = await this.parse(AddFasta)

    const access = await this.getAccess()

    const assemblyName = flags.assembly ?? path.basename(args['input-file'])

    const fastaIsFileId = await isFileId(
      args['input-file'],
      access.address,
      access.accessToken,
    )
    const isExternal = isValidHttpUrl(args['input-file'])

    let body
    if (isExternal) {
      if (flags.index === undefined) {
        this.error(
          'Please provide the URL to the index of the external fasta file',
        )
      }
      body = {
        assemblyName,
        typeName: 'AddAssemblyFromExternalChange',
        externalLocation: {
          fa: args['input-file'],
          fai: flags.index,
        },
      }
    } else if (flags['not-editable']) {
      const gzi = flags.gzi ?? `${args['input-file']}.gzi`
      const fai = flags.fai ?? `${args['input-file']}.fai`

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

      if (!fs.existsSync(gzi) && !gziIsFileId) {
        this.error(
          `Only bgzip'd and indexed fasta files are supported at the moment. "${gzi}" is neither a file or a file id`,
        )
      }
      if (!fs.existsSync(fai) && !faiIsFileId) {
        this.error(
          `Only bgzip'd and indexed fasta files are supported at the moment. "${fai}" is neither a file or a file id`,
        )
      }

      const faId = fastaIsFileId
        ? args['input-file']
        : await this.uploadFile(
            access.address,
            access.accessToken,
            args['input-file'],
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
            true,
          )

      const gziId = gziIsFileId
        ? gzi
        : await this.uploadFile(
            access.address,
            access.accessToken,
            gzi,
            'application/x-gzi',
            true,
          )

      body = {
        assemblyName,
        typeName: 'AddAssemblyFromFileChange',
        fileIds: {
          fa: faId,
          fai: faiId,
          gzi: gziId,
        },
      }
    } else {
      if (!isExternal && !fs.existsSync(args['input-file']) && !fastaIsFileId) {
        this.error(`Input "${args['input-file']}" is not valid`)
      }
      const fileId = fastaIsFileId
        ? args['input-file']
        : await this.uploadFile(
            access.address,
            access.accessToken,
            args['input-file'],
            'text/x-fasta',
            false,
          )
      body = {
        assemblyName,
        fileIds: { fa: fileId },
        typeName: 'AddAssemblyFromFileChange',
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
