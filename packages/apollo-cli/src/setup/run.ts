import { spawn } from 'node:child_process'
import readline from 'node:readline'

export interface RunOptions {
  cwd: string
  env?: NodeJS.ProcessEnv
}

/**
 * The CLI's environment without the variables Yarn sets when it runs a
 * command, e.g. a NODE_OPTIONS that loads another project's PnP hook, so
 * they don't leak into the release's own Yarn
 */
function cleanEnv(): NodeJS.ProcessEnv {
  return Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) =>
        !/^(NODE_OPTIONS|npm_|YARN_|BERRY_|PROJECT_CWD$|INIT_CWD$)/i.test(key),
    ),
  )
}

/**
 * Run Node (the same Node that's running the CLI) with the given arguments,
 * prefixing each line of its output with `[label]`. Node is spawned directly,
 * without a shell, so this works the same way on Windows.
 */
export async function runNode(
  label: string,
  args: string[],
  { cwd, env }: RunOptions,
): Promise<string> {
  const child = spawn(process.execPath, args, {
    cwd,
    env: { ...cleanEnv(), ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const output: string[] = []
  for (const [stream, write] of [
    [child.stdout, (line: string) => process.stdout.write(line)],
    [child.stderr, (line: string) => process.stderr.write(line)],
  ] as const) {
    readline.createInterface({ input: stream }).on('line', (line) => {
      output.push(line)
      write(`[${label}] ${line}\n`)
    })
  }
  const exitCode = await new Promise<number | null>((resolve, reject) => {
    child.on('error', reject)
    child.on('close', resolve)
  })
  if (exitCode !== 0) {
    throw new Error(`Step "${label}" failed with exit code ${exitCode}`)
  }
  return output.join('\n')
}
