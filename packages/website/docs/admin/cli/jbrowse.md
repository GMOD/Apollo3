# `apollo jbrowse`

Commands to manage the JBrowse configuration

- [`apollo jbrowse desktop JBROWSEFILE`](#apollo-jbrowse-desktop-jbrowsefile)
- [`apollo jbrowse get-config`](#apollo-jbrowse-get-config)
- [`apollo jbrowse set-config INPUTFILE`](#apollo-jbrowse-set-config-inputfile)

## `apollo jbrowse desktop JBROWSEFILE`

Generate JBrowse file for use with desktop client

```
USAGE
  $ apollo jbrowse desktop JBROWSEFILE [--profile <value>] [--config-file <value>] [-o | -w <value>] [-f <value>]

ARGUMENTS
  JBROWSEFILE  Generated JBrowse file

FLAGS
  -f, --gff3-file=<value>    generated session will open the specified file
  -o, --open                 open generated file
  -w, --open-with=<value>    open generated file with specified application
      --config-file=<value>  Use this config file (mostly for testing)
      --profile=<value>      Use credentials from this profile

DESCRIPTION
  Generate JBrowse file for use with desktop client

  Generates a file that can be opened with JBrowse Desktop. This file has Apollo already configured and, optionally, a
  GFF3 for local editing configured as well.

EXAMPLES
  Generate JBrowse file:

    $ apollo jbrowse desktop apollo.jbrowse

  Generate JBrowse file and open with default handler:

    $ apollo jbrowse desktop apollo.jbrowse --open

  Generate JBrowse file and open with specified application:

    $ apollo jbrowse desktop apollo.jbrowse --open-with=path/to/jbrowse.AppImage

  Generate JBrowse file opening specified gff3 file:

    $ apollo jbrowse desktop apollo.jbrowse --gff3-file=path/to/file.gff3
```

_See code:
[src/commands/jbrowse/desktop.ts](https://github.com/GMOD/Apollo3/blob/v0.3.10/packages/apollo-cli/src/commands/jbrowse/desktop.ts)_

## `apollo jbrowse get-config`

Get JBrowse configuration from Apollo

```
USAGE
  $ apollo jbrowse get-config [--profile <value>] [--config-file <value>]

FLAGS
  --config-file=<value>  Use this config file (mostly for testing)
  --profile=<value>      Use credentials from this profile

DESCRIPTION
  Get JBrowse configuration from Apollo

  Print to stdout the JBrowse configuration from Apollo in JSON format

EXAMPLES
  Get JBrowse configuration:

    $ apollo jbrowse get-config > config.json
```

_See code:
[src/commands/jbrowse/get-config.ts](https://github.com/GMOD/Apollo3/blob/v0.3.10/packages/apollo-cli/src/commands/jbrowse/get-config.ts)_

## `apollo jbrowse set-config INPUTFILE`

Set JBrowse configuration

```
USAGE
  $ apollo jbrowse set-config INPUTFILE [--profile <value>] [--config-file <value>]

ARGUMENTS
  INPUTFILE  JBrowse configuration file

FLAGS
  --config-file=<value>  Use this config file (mostly for testing)
  --profile=<value>      Use credentials from this profile

DESCRIPTION
  Set JBrowse configuration

  Set JBrowse configuration in Apollo collaboration server

EXAMPLES
  Add JBrowse configuration:

    $ apollo jbrowse set-config config.json
```

_See code:
[src/commands/jbrowse/set-config.ts](https://github.com/GMOD/Apollo3/blob/v0.3.10/packages/apollo-cli/src/commands/jbrowse/set-config.ts)_
