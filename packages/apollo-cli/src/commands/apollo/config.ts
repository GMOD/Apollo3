import { Command } from '@oclif/core'
import { Config } from '../../config';

const yaml = require('js-yaml');

export default class ApolloConfig extends Command {
  static description = 'Get or set Apollo configuration options'
  static args = [
    {
      name: 'key', 
      description: 'Name of the configuration parameter',
      required: true,
    },
    {
      name: 'value', 
      description: 'Parameter value'
    }
  ]

  public async run(): Promise<void> {
    const { args } = await this.parse(ApolloConfig)

    const config: Config = new Config()
    
    // const key: string[] = args['key'].split('.')
    // let currentValue = JSON.parse(JSON.stringify(config))
    // console.log(currentValue)

    // for (const k of key) {
    //   currentValue = currentValue[k]
    // }

    // if (args['value'] === undefined) {
    //   this.log(currentValue)
    //   this.exit(0)
    // }


  }
}
