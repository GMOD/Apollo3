# @apollo-annotation/shared

Code that the [Apollo](https://apollo.jbrowse.org) collaboration server, JBrowse
plugin and CLI share. It includes the built-in changes and checks, GFF3 import
and export, and the messages the server and client exchange.

This is an internal package. It's published so the other Apollo packages can
depend on it, and its API can change in any release. To use Apollo, see
[apollo.jbrowse.org](https://apollo.jbrowse.org). To write an Apollo plugin, use
[@apollo-annotation/common](https://www.npmjs.com/package/@apollo-annotation/common)
instead.

This package is part of the [Apollo monorepo](https://github.com/GMOD/Apollo3).
During development, `yarn workspace @apollo-annotation/shared start` rebuilds it
on every change. See [CONTRIBUTING.md](../../CONTRIBUTING.md).
