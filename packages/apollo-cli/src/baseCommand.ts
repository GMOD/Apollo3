import { Command, Flags, Interfaces } from '@oclif/core'

import { Config } from './Config.js'
import { checkConfigfileExists } from './utils.js'

export type Flags<T extends typeof Command> = Interfaces.InferredFlags<
  (typeof BaseCommand)['baseFlags'] & T['flags']
>
export type Args<T extends typeof Command> = Interfaces.InferredArgs<T['args']>
export abstract class BaseCommand<T extends typeof Command> extends Command {
  static baseFlags = {
    profile: Flags.string({
      description: 'Use credentials from this profile',
      default: 'default',
    }),
    'config-file': Flags.string({
      description: 'Use this config file (mostly for testing)',
    }),
  }

  protected flags!: Flags<T>
  protected args!: Args<T>

  public async init(): Promise<void> {
    await super.init()
    const { args, flags } = await this.parse({
      flags: this.ctor.flags,
      baseFlags: (super.ctor as typeof BaseCommand).baseFlags,
      args: this.ctor.args,
      strict: this.ctor.strict,
    })
    this.flags = flags as Flags<T>
    this.args = args as Args<T>
  }

  private getConfig(configFile: string | undefined): Config {
    if (configFile === undefined) {
      configFile = path.join(this.config.configDir, 'config.yaml')
    }
    checkConfigfileExists(configFile)
    const config: Config = new Config(configFile)
    return config
  }

  public async getAccess(
    configFile: string | undefined,
    profileName: string,
  ): Promise<{ address: string; accessToken: string }> {
    const config: Config = this.getConfig(configFile)
    return config.getAccess(profileName)
  }

  protected async catch(err: Error & { exitCode?: number }): Promise<unknown> {
    // add any custom logic to handle errors from the command
    // or simply return the parent class error handling
    return super.catch(err)
  }

  protected async finally(_: Error | undefined): Promise<unknown> {
    // called after run and catch regardless of whether or not the command errored
    return super.finally(_)
  }
}
