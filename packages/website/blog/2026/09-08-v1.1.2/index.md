---
authors: garrettjstevens
---

# Version 1.1.2

We are excited to release version `v1.1.2` of Apollo 3. This patch release
includes a few CLI improvements and an import fix since `v1.1.1`.

<!-- truncate -->

## Improved functionality

### CLI request timeout

CLI commands now accept a `--timeout` flag, which defaults to one hour. You can
set it higher for commands that you expect to run for a long time.

## Bug fixes

### Auth type selection in `apollo config`

The interactive prompt in `apollo config` for selecting an auth type is
displayed correctly again.

### Importing GFF3 with non-adjacent CDS lines

Importing a GFF3 file where the lines for a CDS aren't next to each other no
longer creates an extra CDS.

## For more information

For more details on any of the changes mentioned as well as many more changes
that have been made, please reference the associated GitHub issues.

- Upgrade oclif CLI framework to v4 by @garrettjstevens in
  https://github.com/GMOD/Apollo3/pull/818
- Add configurable timeout to CLI by @garrettjstevens in
  https://github.com/GMOD/Apollo3/pull/825
- Fix display of auth type selection in CLI by @garrettjstevens in
  https://github.com/GMOD/Apollo3/pull/835
- Fix import when CDS lines aren't together in file by @garrettjstevens in
  https://github.com/GMOD/Apollo3/pull/834

**Full Changelog**: https://github.com/GMOD/Apollo3/compare/v1.1.1...v1.1.2
