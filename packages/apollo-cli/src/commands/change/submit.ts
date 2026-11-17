import { readFile } from 'node:fs/promises'

import { Args, Flags } from '@oclif/core'

import { BaseCommand } from '../../baseCommand.js'

interface ChangeJSON {
  typeName: string
  [key: string]: unknown
}

export default class Submit extends BaseCommand<typeof Submit> {
  static summary = 'Submit one or more changes to Apollo'
  static description = `Submit serialized change(s) directly to Apollo. Any change type known to the server can be submitted, including custom change types added by plugins. This is a low-level command; the change JSON must contain everything the change type requires (e.g. "typeName", "assembly", "changedIds").

The change JSON can be passed via argument or stdin or use the --change-json-file option. To submit multiple changes, pass a JSON array; the changes are submitted one at a time in order.
`

  static examples = [
    {
      description: 'Submit a single change from inline JSON',
      command:
        '<%= config.bin %> <%= command.id %> \'{"typeName":"TypeChange","changedIds":["<featureId>"],"assembly":"<assemblyId>","featureId":"<featureId>","oldType":"BAC","newType":"G_quartet"}\'',
    },
    {
      description: 'Submit a change from stdin JSON',
      command:
        'echo \'{"typeName":"MyPluginChange","assembly":"<assemblyId>", ...}\' | <%= config.bin %> <%= command.id %>',
    },
    {
      description: 'Submit changes from a file',
      command:
        '<%= config.bin %> <%= command.id %> --change-json-file changes.json',
    },
  ]

  static flags = {
    'change-json-file': Flags.file({
      char: 'F',
      description: 'File with JSON describing the change(s) to submit',
      exists: true,
    }),
  }

  static args = {
    'change-json': Args.string({
      description:
        'Inline JSON describing the change(s) to submit. Can also be provided via stdin.',
    }),
  }

  public async run(): Promise<void> {
    const { 'change-json': changeJSONString } = this.args
    const { 'change-json-file': changeJSONFile } = this.flags
    if (changeJSONString && changeJSONFile) {
      this.error(
        'Cannot provide both a change JSON argument and --change-json-file',
      )
    }
    let jsonText = changeJSONString
    if (changeJSONFile) {
      jsonText = await readFile(changeJSONFile, 'utf8')
    }
    if (!jsonText) {
      this.error(
        'Must provide a change JSON via argument, stdin, or --change-json-file',
      )
    }
    let changes: ChangeJSON[]
    try {
      changes = parseChangeJSON(jsonText)
    } catch (error) {
      this.logToStderr('Error: change JSON is not valid')
      if (error instanceof Error || typeof error === 'string') {
        this.error(error)
      }
      throw error
    }
    for (const change of changes) {
      const result = await this.post('changes', JSON.stringify(change))
      this.log(JSON.stringify(result))
    }
  }
}

function parseChangeJSON(changeJSONString: string): ChangeJSON[] {
  const changeJSON: unknown = JSON.parse(changeJSONString)
  const changes = Array.isArray(changeJSON) ? changeJSON : [changeJSON]
  if (changes.length === 0) {
    throw new Error('Change array is empty')
  }
  for (const change of changes) {
    assertChangeIsValid(change)
  }
  return changes as ChangeJSON[]
}

function assertChangeIsValid(change: unknown): asserts change is ChangeJSON {
  if (typeof change !== 'object' || change === null || Array.isArray(change)) {
    throw new TypeError(
      `Change is not a key-value record: '${JSON.stringify(change)}'`,
    )
  }
  if (
    !('typeName' in change) ||
    typeof change.typeName !== 'string' ||
    !change.typeName
  ) {
    throw new Error(
      `Change does not contain a "typeName" string: '${JSON.stringify(change)}'`,
    )
  }
}
