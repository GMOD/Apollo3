/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { Args, Flags } from '@oclif/core'
import { ObjectId } from 'bson'

import { FileCommand } from '../../fileCommand.js'
import { submitAssembly } from '../../utils.js'

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
      description: 'Input fasta file or file id',
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
        "The fasta sequence is not editable. Apollo will not load it into the database and instead use the provided indexes to query it. This option assumes the fasta file is bgzip'd with `bgzip` and indexed with `samtools faidx`. Indexes should be named <my.fasta.gz>.gzi and <my.fasta.gz>.fai",
    }),
  }

  public async run(): Promise<void> {
    const { args } = await this.parse(AddFasta)
    const { flags } = await this.parse(AddFasta)

    const access = await this.getAccess()

    const assemblyName = flags.assembly ?? path.basename(args['input-file'])

    const isExternal = isValidHttpUrl(args['input-file'])
    // const inputType =  getInputType(args['input-file'])

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
      // rec = await submitAssembly(
      //   access.address,
      //   access.accessToken,
      //   body,
      //   flags.force,
      // )
    } else if (flags['not-editable']) {
      const gzi = `${args['input-file']}.gzi`
      const fai = `${args['input-file']}.fai`
      if (!fs.existsSync(gzi) || !fs.existsSync(fai)) {
        this.error(
          "Only bgzip'd and indexed fasta files are supported at the moment",
        )
      }
      // Upload fasta file
      const faId = await this.uploadFile(
        access.address,
        access.accessToken,
        args['input-file'],
        'text/x-fasta',
        true,
      )
      // Upload fai index
      const faiId = await this.uploadFile(
        access.address,
        access.accessToken,
        fai,
        'text/x-fasta',
        false,
      )
      // Upload gzi index
      const gziId = await this.uploadFile(
        access.address,
        access.accessToken,
        gzi,
        'text/x-fasta',
        false,
      )
      body = {
        assemblyName,
        typeName: 'AddAssemblyFromFileIdChange',
        fileIds: {
          fa: faId,
          fai: faiId,
          gzi: gziId,
        },
      }
    } else {
      if (!isExternal && !fs.existsSync(args['input-file'])) {
        this.error(`File ${args['input-file']} does not exist`)
      }
      const fileId = await this.uploadFile(
        access.address,
        access.accessToken,
        args['input-file'],
        'text/x-fasta',
        false,
      )
      body = {
        assemblyName,
        fileId,
        typeName: 'AddAssemblyFromFileChange',
        assembly: new ObjectId().toHexString(),
      }
      // rec = await submitAssembly(
      //   access.address,
      //   access.accessToken,
      //   body,
      //   flags.force,
      // )
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

// function getInputType(x: string): 'external' | 'local' | 'fileId' {
//   if (isValidHttpUrl(x)) {
//     return 'external'
//   }
//   if (fs.existsSync(x)) {
//     return 'local'
//   }
//   if (x.length == 24) {
//     return 'fileId'
//   }
//   throw new Error(`Invalid input: ${x}`)
// }
