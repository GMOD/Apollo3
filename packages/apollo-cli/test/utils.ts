import { it } from 'node:test'
import spawn from 'cross-spawn'

// Workaround to print test name before each test
globalThis.itName = (name: string, fn: Function) => {
  const wrappedFn = () => {
    console.log(`Running test: ${name}`)
    return fn()
  }
  return it(name, wrappedFn)
}

export class shell {
  returncode: number | null
  stdout: string
  stderr: string
  constructor(
    cmd: string,
    strict: boolean = true,
    timeout: number | undefined = undefined,
  ) {
    console.log(cmd)
    cmd = `set -e; set -u; set -o pipefail\n${cmd}`
    const p = spawn.sync(cmd, { shell: '/bin/bash', timeout: timeout })

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
