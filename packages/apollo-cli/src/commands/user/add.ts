import type { SerializedAddUserChange } from '@apollo-annotation/shared'
import { Flags } from '@oclif/core'

import { BaseCommand } from '../../baseCommand.js'

export default class Add extends BaseCommand<typeof Add> {
  static summary = 'Add a user by email before they have logged in'
  static description =
    'The user is created without a username, which is filled in when they log in for the first time. They will have the given role when they log in.'

  static examples = [
    {
      description: 'Add a user with the default "user" role:',
      command: '<%= config.bin %> <%= command.id %> -e jane.doe@example.com',
    },
    {
      description: 'Add a user with the "readOnly" role:',
      command:
        '<%= config.bin %> <%= command.id %> -e jane.doe@example.com -r readOnly',
    },
  ]

  static flags = {
    email: Flags.string({
      char: 'e',
      description: 'Email of the user to add',
      required: true,
    }),
    role: Flags.string({
      char: 'r',
      description: 'Role of the user to add',
      options: ['admin', 'user', 'readOnly', 'none'],
      default: 'user',
    }),
  }

  public async run(): Promise<void> {
    const { flags } = await this.parse(Add)

    const change: SerializedAddUserChange = {
      typeName: 'AddUserChange',
      email: flags.email,
      role: flags.role as SerializedAddUserChange['role'],
    }
    // The changes endpoint doesn't return a body, so don't use `this.post`
    await this.fetch(
      'changes',
      { method: 'POST', body: JSON.stringify(change) },
      { json: true },
    )

    const users = (await this.get('users')) as { email: string }[]
    const email = flags.email.trim().toLowerCase()
    const user = users.find((u) => u.email.toLowerCase() === email)
    this.log(JSON.stringify(user, null, 2))
  }
}
