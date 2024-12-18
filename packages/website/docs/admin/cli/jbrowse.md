# `apollo jbrowse`

Commands to manage the JBrowse configuration

- [`apollo jbrowse get-config`](#apollo-jbrowse-get-config)
- [`apollo jbrowse set-config INPUTFILE`](#apollo-jbrowse-set-config-inputfile)

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
[src/commands/jbrowse/get-config.ts](https://github.com/GMOD/Apollo3/blob/v0.2.2/packages/apollo-cli/src/commands/jbrowse/get-config.ts)_

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
[src/commands/jbrowse/set-config.ts](https://github.com/GMOD/Apollo3/blob/v0.2.2/packages/apollo-cli/src/commands/jbrowse/set-config.ts)_
