import * as fs from 'node:fs'

import { Agent, FormData, Response, fetch } from 'undici'

import { ConfigError } from './ApolloConf.js'
import { BaseCommand } from './baseCommand.js'
import { createFetchErrorMessage, localhostToAddress } from './utils.js'

export abstract class FileCommand extends BaseCommand<typeof FileCommand> {
  public async init(): Promise<void> {
    await super.init()
  }

  public async uploadFile(
    address: string,
    accessToken: string,
    file: string,
    type: string,
  ): Promise<string> {
    const stream = fs.createReadStream(file, 'utf8')
    const fileStream = new Response(stream)
    const fileBlob = await fileStream.blob()

    const formData = new FormData()
    formData.append('type', type)
    formData.append('file', fileBlob)

    const auth = {
      method: 'POST',
      body: formData,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      dispatcher: new Agent({
        keepAliveTimeout: 10 * 60 * 1000, // 10 minutes
        keepAliveMaxTimeout: 10 * 60 * 1000, // 10 minutes
      }),
    }

    const url = new URL(localhostToAddress(`${address}/files`))
    const response = await fetch(url, auth)
    if (!response.ok) {
      const errorMessage = await createFetchErrorMessage(
        response,
        'uploadFile failed',
      )
      throw new ConfigError(errorMessage)
    }
    const json = (await response.json()) as object
    return json['_id' as keyof typeof json]
  }
}
