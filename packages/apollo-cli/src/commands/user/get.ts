import { Flags } from '@oclif/core'
import { Response } from 'undici'

import { BaseCommand } from '../../baseCommand.js'
import { queryApollo } from '../../utils.js'

export default class Get extends BaseCommand<typeof Get> {
  static summary = 'Get list of users'
  static description =
    'If set, filters username and role must be both satisfied to return an entry'

  static examples = [
    {
      description: 'By username:',
      command: '<%= config.bin %> <%= command.id %> -u Guest',
    },
    {
      description: 'By role:',
      command: '<%= config.bin %> <%= command.id %> -r admin',
    },
    {
      description: 'Use jq for more control:',
      command:
        '<%= config.bin %> <%= command.id %> | jq \'.[] | select(.createdAt > "2024-03-18")\'',
    },
  ]

  static flags = {
    username: Flags.string({
      char: 'u',
      description: 'Find this username',
    }),
    role: Flags.string({
      char: 'r',
      description: 'Get users with this role',
    }),
  }

  public async run(): Promise<void> {
    const { flags } = await this.parse(Get)

    const access = await this.getAccess()

    const users: Response = await queryApollo(
      access.address,
      access.accessToken,
      'users',
    )

    const json = (await users.json()) as object[]
    const out: object[] = []
    for (const x of json) {
      if (
        (flags.username === undefined ||
          x['username' as keyof typeof x] === flags.username) &&
        (flags.role === undefined || x['role' as keyof typeof x] === flags.role)
      ) {
        out.push(x)
      }
    }
    this.log(JSON.stringify(out, null, 2))
  }
}
