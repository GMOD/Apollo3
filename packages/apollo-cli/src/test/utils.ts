import { it } from 'node:test'

import { type CheckResultSnapshot } from '@apollo-annotation/mst'
import spawn from 'cross-spawn'
import { x } from 'joi'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  function itName(name: string, fn: Function): Promise<void>
}

// Workaround to print test name before each test
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
globalThis.itName = (name: string, fn: Function) => {
  const wrappedFn = () => {
    process.stdout.write(`Running test: ${name}\n`)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
    return fn()
  }
  return it(name, wrappedFn)
}

export class Shell {
  returncode: number | null
  stdout: string
  stderr: string
  constructor(cmd: string, strict = true, timeout?: number) {
    process.stdout.write(`${cmd}\n`)
    cmd = `set -e; set -u; set -o pipefail\n${cmd}`
    const p = spawn.sync(cmd, { shell: '/bin/bash', timeout })
    this.returncode = p.status
    this.stdout = p.stdout.toString()
    this.stderr = p.stderr.toString()
    if (strict && this.returncode != 0) {
      throw new Error(
        `${p.error}\nCOMMAND:\n${cmd}\nSTDOUT:\n${this.stdout}\nSTDERR:\n${this.stderr}\nEXIT CODE: ${this.returncode}`,
      )
    }
  }
}

export function deleteAllChecks(
  apollo: string,
  profile: string,
  assembly: string,
) {
  const p = new Shell(`${apollo} assembly check ${profile}`)
  const out = JSON.parse(p.stdout) as CheckResultSnapshot[]
  const checks = out.map((chk) => chk.name)
  new Shell(
    `${apollo} assembly check ${profile} --assembly ${assembly} --delete --check ${checks.join(' ')}`,
  )
}
