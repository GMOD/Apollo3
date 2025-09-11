import { Flags } from '@oclif/core'
import { type Response, fetch } from 'undici'

import { BaseCommand } from '../../baseCommand.js'
import {
  convertCheckNameToId,
  createFetchErrorMessage,
  getAssembly,
  idReader,
  localhostToAddress,
} from '../../utils.js'

async function setChecks(
  address: string,
  accessToken: string,
  assembly: string,
  checkId: string[],
): Promise<Response> {
  const check: { _id: string; checks: string[]; name: string } = {
    _id: assembly,
    checks: checkId,
    name: '',
  }

  const auth = {
    method: 'POST',
    body: JSON.stringify(check),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  }
  const url = new URL(localhostToAddress(`${address}/assemblies/checks`))
  const response = await fetch(url, auth)
  if (!response.ok) {
    const errorMessage = await createFetchErrorMessage(
      response,
      'setChecks failed',
    )
    throw new Error(errorMessage)
  }
  return response
}

async function getCheckTypes(
  address: string,
  accessToken: string,
): Promise<object[]> {
  const auth = {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  }
  const url = new URL(localhostToAddress(`${address}/checks/types`))
  const response = await fetch(url, auth)
  if (!response.ok) {
    const errorMessage = await createFetchErrorMessage(
      response,
      'getCheckTypes failed',
    )
    throw new Error(errorMessage)
  }
  const chk = (await response.json()) as object[]
  return chk
}

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

    const access = await this.getAccess()

    const checkTypes: object[] = await getCheckTypes(
      access.address,
      access.accessToken,
    )
    if (flags.check === undefined && flags.assembly === undefined) {
      this.log(JSON.stringify(checkTypes, null, 2))
      return
    }

    if (flags.assembly === undefined) {
      this.error('Please specify the assembly to manage for checks')
    }

    const asm: string[] = await idReader([flags.assembly])
    const assembly = await getAssembly(
      access.address,
      access.accessToken,
      asm[0],
    )

    const currentChecks: object[] = getCheckTypesForAssembly(
      checkTypes,
      assembly,
    )
    if (flags.check === undefined) {
      this.log(JSON.stringify(currentChecks, null, 2))
      return
    }

    let inputCheckIds: string[] = []
    inputCheckIds = await convertCheckNameToId(
      access.address,
      access.accessToken,
      flags.check,
    )

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

    await setChecks(access.address, access.accessToken, assembly._id, [
      ...newChecks.values(),
    ])
  }
}
