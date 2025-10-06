# CLI (Command Line Interface)

The Apollo CLI allows you to programatically interact with the Apollo
Collaboration Server. This can be used to manage data, such as adding assemblies
and importing annotation features. It can also be used to query the data stored
in Apollo, such as [annotation features](annotation-features),
[check results](checks), or the [changelog](changelog).

## Configuring the CLI

In order to run commands with the Apollo CLI, you first must log in to Apollo.
The first time doing this, you can run the command `apollo config`, which will
prompt you to choose how to log in and answer your password.

:::info

The Apollo login configuration is stored in a configuration file on your
computer. If you ever need to manually edit it, you can get the file location by
passing the `--get-config-file` flag to the `apollo config` command.

:::

It is suggested that if you want to use the CLI as an
[administrator](administrators) to configure a root user to run the CLI
commands. See the `ALLOW_ROOT_USER` and `ROOT_USER_PASSWORD` options in the
[configuration options](../installation/configuration-options). You can also log
in to Apollo as a guest user with the CLI. Logging in as any other user requires
OAuth authentication, which is often not straighforward and is not covered here.

You can have multiple login profiles set up with the CLI, and each profile can
be configured for a different collaboration server. To use a profile other than
the default one, pass the `--profile` flag with the profile name in the CLI
command.

If you want to configure Apollo programatically instead of using the interactive
`apollo config` prompt, you can pass individual configuration values to the
`apollo config` command as well. For example:

```sh
apollo config address http://localhost:3999
apollo config accessType root
apollo config rootPassword mysecretpassword
```

## Logging in

After configuring the CLI, you can log in by running `apollo login` command and
log out by running the `apollo logout` command. If you want to log in again
without first logging out, you can use `apollo login --force`. Since the key the
CLI receives when logging in expires, you will need to periodically log in
again.

## CLI command reference

See each command for more information. You can also access the same information
by using the `--help` flag along with the various commands in the Apollo CLI.

```mdx-code-block
import DocCardList from '@theme/DocCardList';

<DocCardList />
```
