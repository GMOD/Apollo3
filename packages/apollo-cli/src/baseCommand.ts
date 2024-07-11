import path from 'node:path'

import { Command, Flags, Interfaces } from '@oclif/core'

import { ApolloConf } from './ApolloConf.js'
import { checkConfigfileExists } from './utils.js'

export type Flags<T extends typeof Command> = Interfaces.InferredFlags<
  (typeof BaseCommand)['baseFlags'] & T['flags']
>
export type Args<T extends typeof Command> = Interfaces.InferredArgs<T['args']>
export abstract class BaseCommand<T extends typeof Command> extends Command {
  static baseFlags = {
    profile: Flags.string({
      description: 'Use credentials from this profile',
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

  private getConfig(configFile: string | undefined): ApolloConf {
    if (configFile === undefined) {
      configFile = path.join(this.config.configDir, 'config.yml')
    }
    checkConfigfileExists(configFile)
    const config: ApolloConf = new ApolloConf(configFile)
    return config
  }

  public async getAccess(
    configFile: string | undefined,
    profileName: string | undefined,
  ): Promise<{ address: string; accessToken: string }> {
    const config: ApolloConf = this.getConfig(configFile)

    if (profileName === undefined) {
      profileName = process.env.APOLLO_PROFILE ?? 'default'
    }

    return config.getAccess(profileName)
  }

  protected async catch(err: Error & { exitCode?: number }): Promise<unknown> {
    if (err.cause instanceof Error) {
      console.error(err.cause)
    }
    return super.catch(err)
  }

  protected async finally(_: Error | undefined): Promise<unknown> {
    // called after run and catch regardless of whether or not the command errored
    return super.finally(_)
  }
}
