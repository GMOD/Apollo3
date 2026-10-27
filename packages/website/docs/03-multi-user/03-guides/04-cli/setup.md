# `apollo setup`

Install and configure an Apollo collaboration server

- [`apollo setup`](#apollo-setup)

## `apollo setup`

Install and configure an Apollo collaboration server

```
USAGE
  $ apollo setup [-d <value>] [--apollo-version <value>] [--jbrowse-dir <value>] [--jbrowse-config-files
    <value>] [--url <value>] [--port <value>] [--name <value>] [--description <value>] [--mongodb existing|embedded]
    [--mongodb-uri <value>] [--mongodb-dir <value>] [--login root|guest|google|microsoft...] [--root-password <value>]
    [--guest-role admin|user|readOnly] [--google-client-id <value>] [--google-client-secret <value>]
    [--microsoft-client-id <value>] [--microsoft-client-secret <value>] [--initial-admin-email <value>]
    [--default-new-user-role admin|user|readOnly|none] [--upload-dir <value>] [-y] [--dry-run] [--force]

FLAGS
  -d, --install-dir=<value>              Directory to install Apollo in
  -y, --yes                              Use the defaults for questions not answered by a flag
      --apollo-version=<value>           Apollo version to install (default: this CLI version)
      --default-new-user-role=<option>   Role for new users when they first log in
                                         <options: admin|user|readOnly|none>
      --description=<value>              Server description
      --dry-run                          Print what setup would do and the .env, then exit
      --force                            Rebuild the release even if it was already built
      --google-client-id=<value>         Google client ID
      --google-client-secret=<value>     Google client secret
      --guest-role=<option>              Role for the guest user
                                         <options: admin|user|readOnly>
      --initial-admin-email=<value>      Email of a user who becomes admin on first login
      --jbrowse-config-files=<value>     Comma-separated JBrowse config files, relative to the JBrowse directory
      --jbrowse-dir=<value>              Existing JBrowse Web directory
      --login=<option>...                Login methods to enable
                                         <options: root|guest|google|microsoft>
      --microsoft-client-id=<value>      Microsoft client ID
      --microsoft-client-secret=<value>  Microsoft client secret
      --mongodb=<option>                 Use an existing MongoDB server, or an embedded one
                                         <options: existing|embedded>
      --mongodb-dir=<value>              Directory for the embedded MongoDB data
      --mongodb-uri=<value>              URI of an existing MongoDB server
      --name=<value>                     Server name
      --port=<value>                     Port for the server to listen on
      --root-password=<value>            Root user password
      --upload-dir=<value>               Directory for uploaded files
      --url=<value>                      Public URL users will open Apollo at

DESCRIPTION
  Install and configure an Apollo collaboration server

  Asks a few questions, then downloads and builds the collaboration server, adds the Apollo plugin to an existing
  JBrowse Web directory, writes the server's .env file, and prints how to start the server.

  JBrowse must already be installed (see "jbrowse create" from @jbrowse/cli) and have at least one config file. Setup
  adds files to the JBrowse directory but never overwrites a file or changes a config file.

  Every question has a matching flag. With --yes, setup uses the defaults for every question not answered by a flag.

  Run setup again with the same install directory to upgrade to a new --apollo-version, or to roll back to an older one.

EXAMPLES
  Answer the questions interactively:

    $ apollo setup

  Install without questions, using an embedded MongoDB:

    $ apollo setup --yes --install-dir /opt/apollo --jbrowse-dir /var/www/jbrowse --mongodb embedded
```

_See code:
[src/commands/setup.ts](https://github.com/GMOD/Apollo3/blob/v1.2.0/packages/apollo-cli/src/commands/setup.ts)_
