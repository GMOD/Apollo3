import * as fs from 'node:fs'

import type { SerializedAddFeaturesFromFileChange } from '@apollo-annotation/shared'
import { Args, Flags } from '@oclif/core'
import { Agent, type RequestInit, fetch } from 'undici'

import { FileCommand } from '../../fileCommand.js'
import {
  convertAssemblyNameToId,
  createFetchErrorMessage,
  isFileId,
  localhostToAddress,
} from '../../utils.js'

export default class Import extends FileCommand {
  static summary = 'Import features from local gff file'
  static description = 'By default, features are added to the existing ones.'

  static examples = [
    {
      description:
        'Delete features in myAssembly and then import features.gff3:',
      command:
        '<%= config.bin %> <%= command.id %> features.gff3 -d -a myAssembly',
    },
  ]

  static args = {
    'input-file': Args.string({
      description: 'Input gff file',
      required: true,
    }),
  }

  static flags = {
    assembly: Flags.string({
      char: 'a',
      description: 'Import into this assembly name or assembly ID',
      required: true,
    }),
    'delete-existing': Flags.boolean({
      char: 'd',
      description: 'Delete existing features before importing',
    }),
    'no-strict': Flags.boolean({
      description:
        "If any lines in the GFF3 can't be processed, skip them instead of aborting the import",
    }),
  }

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(Import)

    const inputFile = args['input-file']

    const access = await this.getAccess()

    const assembly = await convertAssemblyNameToId(
      access.address,
      access.accessToken,
      [flags.assembly],
    )
    if (assembly.length === 0) {
      this.error(
        `Assembly "${flags.assembly}" does not exist. Perhaps you want to create this assembly first`,
      )
    }

    let uploadId
    const inputFileIsFileId = await isFileId(
      inputFile,
      access.address,
      access.accessToken,
    )
    if (inputFileIsFileId) {
      uploadId = inputFile
    } else {
      if (!fs.existsSync(inputFile)) {
        this.error(`File "${inputFile}" does not exist`)
      }
      uploadId = await this.uploadFile(
        access.address,
        access.accessToken,
        inputFile,
        'text/x-gff3',
        false,
      )
    }

    const body: SerializedAddFeaturesFromFileChange = {
      typeName: 'AddFeaturesFromFileChange',
      assembly: assembly[0],
      fileId: uploadId,
      deleteExistingFeatures: flags['delete-existing'],
      parseOptions: { strict: !flags['no-strict'] },
    }
    const auth: RequestInit = {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        Authorization: `Bearer ${access.accessToken}`,
        'Content-Type': 'application/json',
      },
      dispatcher: new Agent({ headersTimeout: 60 * 60 * 1000 }),
    }

    const url = new URL(localhostToAddress(`${access.address}/changes`))
    const response = await fetch(url, auth)
    if (!response.ok) {
      const errorMessage = await createFetchErrorMessage(
        response,
        'importFeatures failed',
      )
      throw new Error(errorMessage)
    }
  }
}
