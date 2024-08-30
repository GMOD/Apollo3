# `apollo file`

Delete files from the Apollo server

- [`apollo file delete`](#apollo-file-delete)
- [`apollo file download`](#apollo-file-download)
- [`apollo file get`](#apollo-file-get)
- [`apollo file upload`](#apollo-file-upload)

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

  Deleted files are printed to stdout. See also `apollo file get` to list the
  files on the server

EXAMPLES
  Delete file multiple files:

    $ apollo file delete -i 123...abc xyz...789
```

_See code:
[src/commands/file/delete.ts](https://github.com/GMOD/Apollo3/blob/v0.1.19/packages/apollo-cli/src/commands/file/delete.ts)_

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
[src/commands/file/download.ts](https://github.com/GMOD/Apollo3/blob/v0.1.19/packages/apollo-cli/src/commands/file/download.ts)_

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
[src/commands/file/get.ts](https://github.com/GMOD/Apollo3/blob/v0.1.19/packages/apollo-cli/src/commands/file/get.ts)_

## `apollo file upload`

Upload a local file to the Apollo server

```
USAGE
  $ apollo file upload -i <value> [--profile <value>] [--config-file <value>] [-t
    text/x-fasta|text/x-gff3|autodetect]

FLAGS
  -i, --input-file=<value>   (required) Local file to upload
  -t, --type=<option>        [default: autodetect] File type or "autodetect" for automatic detection.
                             NB: There is no check for whether the file complies to this type
                             <options: text/x-fasta|text/x-gff3|autodetect>
      --config-file=<value>  Use this config file (mostly for testing)
      --profile=<value>      Use credentials from this profile

DESCRIPTION
  Upload a local file to the Apollo server

  This command only uploads a file and returns the corresponding file id. To add
  an assembly based on this file use `apollo assembly add-file`. To upload & add
  an assembly in a single pass see commands `apollo assembly add-*`

EXAMPLES
  Upload local file, type auto-detected:

    $ apollo file upload -i genome.fa > file.json
```

_See code:
[src/commands/file/upload.ts](https://github.com/GMOD/Apollo3/blob/v0.1.19/packages/apollo-cli/src/commands/file/upload.ts)_
