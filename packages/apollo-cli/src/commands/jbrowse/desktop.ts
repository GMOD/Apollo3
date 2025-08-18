import fs from 'node:fs'

import { Args, Flags } from '@oclif/core'
import open from 'open'

import { BaseCommand } from '../../baseCommand.js'

export default class Desktop extends BaseCommand<typeof Desktop> {
  static summary = 'Generate JBrowse file for use with desktop client'
  static description = 'Generate JBrowse file for use with desktop client'

  static examples = [
    {
      description: 'Generate JBrowse file:',
      command: '<%= config.bin %> <%= command.id %> apollo.jbrowse',
    },
    {
      description: 'Generate JBrowse file and open with default handler:',
      command: '<%= config.bin %> <%= command.id %> apollo.jbrowse --open',
    },
    {
      description: 'Generate JBrowse file and open with specified application:',
      command:
        '<%= config.bin %> <%= command.id %> apollo.jbrowse --open-with=path/to/jbrowse.AppImage',
    },
  ]

  static args = {
    jbrowseFile: Args.string({
      description: 'Generated JBrowse file',
      required: true,
    }),
  }

  static flags = {
    open: Flags.boolean({
      char: 'o',
      description: 'open generated file',
      exclusive: ['open-with'],
    }),
    'open-with': Flags.string({
      char: 'w',
      description: 'open generated file with specified application',
      exclusive: ['open'],
    }),
  }

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(Desktop)
    const jbrowseFileContent = {
      plugins: [
        {
          name: 'Apollo',
          umdUrl:
            'https://cdn.jsdelivr.net/npm/@apollo-annotation/jbrowse-plugin-apollo/dist/jbrowse-plugin-apollo.umd.production.min.js',
        },
      ],
      assemblies: [],
      configuration: {
        theme: {
          palette: {
            primary: {
              main: '#0c4f4b',
            },
            secondary: {
              main: '#1AA39B',
            },
            tertiary: {
              main: '#4f0c10',
            },
            quaternary: {
              main: '#571AA3',
            },
            framesCDS: [
              null,
              {
                main: 'rgb(204,121,167)',
              },
              {
                main: 'rgb(230,159,0)',
              },
              {
                main: 'rgb(240,228,66)',
              },
              {
                main: 'rgb(86,180,233)',
              },
              {
                main: 'rgb(0,114,178)',
              },
              {
                main: 'rgb(0,158,115)',
              },
            ],
          },
        },
        ApolloPlugin: {
          ontologies: [
            {
              name: 'Sequence Ontology',
              source: {
                uri: 'https://github.com/The-Sequence-Ontology/SO-Ontologies/raw/refs/heads/master/Ontology_Files/so.json',
                locationType: 'UriLocation',
              },
            },
          ],
        },
      },
    }

    fs.writeFile(
      args.jbrowseFile,
      JSON.stringify(jbrowseFileContent),
      (err) => {
        if (err) {
          console.error('Error writing', args.jbrowseFile, ':', err)
          throw new Error(err.message)
        }
      },
    )

    if (flags.open || flags['open-with']) {
      let options = {}
      if (flags['open-with']) {
        options = { app: { name: flags['open-with'] } }
      }
      await open(args.jbrowseFile, options)
    }
  }
}
