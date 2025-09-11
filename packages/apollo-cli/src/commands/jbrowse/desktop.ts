import fsPromises from 'node:fs/promises'
import path from 'node:path'

import { Args, Flags } from '@oclif/core'
import { nanoid } from 'nanoid'
import open from 'open'

import { BaseCommand } from '../../baseCommand.js'

class Gff3File {
  filepath: string
  stem: string
  uid: string

  constructor(filepath: string) {
    this.stem = path.basename(filepath, path.extname(filepath))
    this.uid = `${this.stem}-${path.basename(filepath)}-${nanoid(8)}`
    this.filepath = path.resolve(filepath)
  }

  assemblyConfig() {
    return {
      name: this.uid,
      aliases: [this.stem],
      sequence: {
        type: 'ReferenceSequenceTrack',
        trackId: `sequenceConfigId-${this.stem}`,
        adapter: {
          type: 'ApolloSequenceAdapter',
          assemblyId: this.uid,
        },
        metadata: {
          apollo: true,
          file: this.filepath,
        },
      },
      displayName: this.stem,
    }
  }

  trackConfig() {
    return {
      type: 'ApolloTrack',
      trackId: this.uid,
      name: `Annotations (${this.stem})`,
      assemblyNames: [this.uid],
    }
  }
}

export default class Desktop extends BaseCommand<typeof Desktop> {
  static summary = 'Generate JBrowse file for use with desktop client'
  static description =
    'Generates a file that can be opened with JBrowse Desktop. This file has Apollo already configured and, optionally, a GFF3 for local editing configured as well.'

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
    {
      description: 'Generate JBrowse file opening specified gff3 file:',
      command:
        '<%= config.bin %> <%= command.id %> apollo.jbrowse --gff3-file=path/to/file.gff3',
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
    'gff3-file': Flags.string({
      char: 'f',
      description: 'generated session will open the specified file',
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
      assemblies: [] as unknown[],
      tracks: [] as unknown[],
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

    if (flags['gff3-file']) {
      const gff3 = new Gff3File(flags['gff3-file'])
      jbrowseFileContent.assemblies.push(gff3.assemblyConfig())
      jbrowseFileContent.tracks.push(gff3.trackConfig())
    }

    await fsPromises.writeFile(
      args.jbrowseFile,
      JSON.stringify(jbrowseFileContent),
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
