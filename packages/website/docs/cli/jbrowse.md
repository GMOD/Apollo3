# `apollo jbrowse`

Get Jbrowse configuration from Apollo

- [`apollo jbrowse get-config`](#apollo-jbrowse-get-config)
- [`apollo jbrowse set-config`](#apollo-jbrowse-set-config)

## `apollo jbrowse get-config`

Get Jbrowse configuration from Apollo

```
USAGE
  $ apollo jbrowse get-config [--profile <value>] [--config-file <value>]

FLAGS
  --config-file=<value>  Use this config file (mostly for testing)
  --profile=<value>      Use credentials from this profile

DESCRIPTION
  Get Jbrowse configuration from Apollo

  Print to stdout the Jbrowse configuration from Apollo in json format
```

_See code:
[src/commands/jbrowse/get-config.ts](https://github.com/GMOD/Apollo3/blob/v0.1.19/packages/apollo-cli/src/commands/jbrowse/get-config.ts)_

## `apollo jbrowse set-config`

Add jbrowse configuration

```
USAGE
  $ apollo jbrowse set-config -i <value> [--profile <value>] [--config-file <value>]

FLAGS
  -i, --input-file=<value>   (required) Input jbrowse configuration file
      --config-file=<value>  Use this config file (mostly for testing)
      --profile=<value>      Use credentials from this profile

DESCRIPTION
  Add jbrowse configuration

  Add jbrowse configuration into apollo database

EXAMPLES
  Add jbrowse configuration:

    $ apollo jbrowse set-config -i config.json
```

_See code:
[src/commands/jbrowse/set-config.ts](https://github.com/GMOD/Apollo3/blob/v0.1.19/packages/apollo-cli/src/commands/jbrowse/set-config.ts)_
