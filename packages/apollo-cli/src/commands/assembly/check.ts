import { Flags } from '@oclif/core'

import { BaseCommand } from '../../baseCommand.js'
import { idReader } from '../../utils.js'

function getCheckTypesForAssembly(
  checkTypes: object[],
  assembly: object,
): object[] {
  const checks = []
  for (const chkType of checkTypes) {
    for (const chk of assembly['checks' as keyof typeof assembly] as string[]) {
      if (chkType['_id' as keyof typeof chkType] === chk) {
        checks.push(chkType)
      }
    }
  }
  return checks
}

export default class Check extends BaseCommand<typeof Check> {
  static summary = 'Add, view, or delete checks to assembly'
  static description =
    'Manage checks, i.e. the rules ensuring features in an assembly are plausible. \
This command only sets the checks to apply, to retrieve features flagged by \
these checks use `apollo feature check`.'

  static examples = [
    {
      description: 'View available check types:',
      command: '<%= config.bin %> <%= command.id %>',
    },
    {
      description: 'View checks set for assembly hg19:',
      command: '<%= config.bin %> <%= command.id %> -a hg19',
    },
    {
      description: 'Add checks to assembly:',
      command: '<%= config.bin %> <%= command.id %> -a hg19 -c CDSCheck',
    },
    {
      description: 'Delete checks from assembly:',
      command:
        '<%= config.bin %> <%= command.id %> -a hg19 -c CDSCheck --delete',
    },
  ]

  static flags = {
    assembly: Flags.string({
      char: 'a',
      description: 'Manage checks in this assembly',
    }),
    check: Flags.string({
      char: 'c',
      description:
        'Add these check names or IDs. If unset, print the checks set for assembly',
      multiple: true,
    }),
    delete: Flags.boolean({
      char: 'd',
      description: 'Delete (instead of adding) checks',
    }),
  }

  public async run(): Promise<void> {
    const { flags } = await this.parse(Check)

    const checkTypes = (await this.get('checks/types')) as object[]

    if (flags.check === undefined && flags.assembly === undefined) {
      this.log(JSON.stringify(checkTypes, null, 2))
      return
    }

    if (flags.assembly === undefined) {
      this.error('Please specify the assembly to manage for checks')
    }

    const asm: string[] = await idReader([flags.assembly])
    const assembly = await this.getAssembly(asm[0])

    const currentChecks: object[] = getCheckTypesForAssembly(
      checkTypes,
      assembly,
    )
    if (flags.check === undefined) {
      this.log(JSON.stringify(currentChecks, null, 2))
      return
    }

    const inputCheckIds = await this.convertCheckNameToId(flags.check)

    const newChecks = new Set<string>()
    if (flags.delete) {
      for (const chk of currentChecks) {
        const chkId = chk['_id' as keyof typeof chk]
        if (!inputCheckIds.includes(chkId)) {
          newChecks.add(chkId)
        }
      }
    } else {
      for (const chk of inputCheckIds) {
        newChecks.add(chk)
      }
      for (const chk of currentChecks) {
        newChecks.add(chk['_id' as keyof typeof chk])
      }
    }

    const check: { _id: string; checks: string[]; name: string } = {
      _id: assembly._id,
      checks: [...newChecks.values()],
      name: '',
    }
    await this.post('assemblies/checks', JSON.stringify(check))
  }
}
