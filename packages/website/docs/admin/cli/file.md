# `apollo file`

Commands to manage files

- [`apollo file delete`](#apollo-file-delete)
- [`apollo file download`](#apollo-file-download)
- [`apollo file get`](#apollo-file-get)
- [`apollo file upload INPUT-FILE`](#apollo-file-upload-input-file)

## `apollo file delete`

Delete files from the Apollo server

```
USAGE
  $ apollo file delete [--profile <value>] [--config-file <value>] [-i <value>]

FLAGS
  -i, --file-id=<value>...   [default: -] IDs of the files to delete
      --config-file=<value>  Use this config file (mostly for testing)
      --profile=<value>      Use credentials from this profile

DESCRIPTION
  Delete files from the Apollo server

  Deleted files are printed to stdout. See also `apollo file get` to list the files on the server

EXAMPLES
  Delete file multiple files:

    $ apollo file delete -i 123...abc xyz...789
```

_See code:
[src/commands/file/delete.ts](https://github.com/GMOD/Apollo3/blob/v0.3.5/packages/apollo-cli/src/commands/file/delete.ts)_

## `apollo file download`

Download a file from the Apollo server

```
USAGE
  $ apollo file download [--profile <value>] [--config-file <value>] [-i <value>] [-o <value>]

FLAGS
  -i, --file-id=<value>      [default: -] ID of the file to download
  -o, --output=<value>       Write output to this file or "-" for stdout. Default to the name of the uploaded file.
      --config-file=<value>  Use this config file (mostly for testing)
      --profile=<value>      Use credentials from this profile

DESCRIPTION
  Download a file from the Apollo server

  See also `apollo file get` to list the files on the server

EXAMPLES
  Download file with id xyz

    $ apollo file download -i xyz -o genome.fa
```

_See code:
[src/commands/file/download.ts](https://github.com/GMOD/Apollo3/blob/v0.3.5/packages/apollo-cli/src/commands/file/download.ts)_

## `apollo file get`

Get list of files uploaded to the Apollo server

```
USAGE
  $ apollo file get [--profile <value>] [--config-file <value>] [-i <value>]

FLAGS
  -i, --file-id=<value>...   Get files matching this IDs
      --config-file=<value>  Use this config file (mostly for testing)
      --profile=<value>      Use credentials from this profile

DESCRIPTION
  Get list of files uploaded to the Apollo server

  Print to stdout the list of files in json format

EXAMPLES
  Get files by id:

    $ apollo file get -i xyz abc
```

_See code:
[src/commands/file/get.ts](https://github.com/GMOD/Apollo3/blob/v0.3.5/packages/apollo-cli/src/commands/file/get.ts)_

## `apollo file upload INPUT-FILE`

Upload a local file to the Apollo server

```
USAGE
  $ apollo file upload INPUT-FILE [--profile <value>] [--config-file <value>] [-t
    text/x-fasta|text/x-gff3|application/x-bgzip-fasta|text/x-fai|application/x-gzi] [-z | -d]

ARGUMENTS
  INPUT-FILE  Local file to upload

FLAGS
  -d, --decompressed         Override autodetection and instruct that input is decompressed
  -t, --type=<option>        Set file type or autodetected it if not set.
                             NB: There is no check for whether the file complies to this type
                             <options: text/x-fasta|text/x-gff3|application/x-bgzip-fasta|text/x-fai|application/x-gzi>
  -z, --gzip                 Override autodetection and instruct that input is gzip compressed
      --config-file=<value>  Use this config file (mostly for testing)
      --profile=<value>      Use credentials from this profile

DESCRIPTION
  Upload a local file to the Apollo server

  This command only uploads a file and returns the corresponding file id.
  To add an assembly based on this file or to upload & add an assembly in a single pass   see `apollo assembly
  add-from-fasta` and `add-from-gff`

EXAMPLES
  Upload local file, type auto-detected:

    $ apollo file upload genome.fa > file.json
```

_See code:
[src/commands/file/upload.ts](https://github.com/GMOD/Apollo3/blob/v0.3.5/packages/apollo-cli/src/commands/file/upload.ts)_
