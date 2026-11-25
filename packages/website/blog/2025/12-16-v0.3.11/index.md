---
authors: garrettjstevens
---

# Beta Version 0.3.11

Version `v0.3.11` of Apollo 3 is a small release with a new CLI command and a
bug fix since `v0.3.10`.

<!-- truncate -->

## Changes

- **New `apollo feature add` command**: Add a top-level feature from the CLI,
  either with flags such as `--min`, `--max`, and `--type`, or as JSON (from a
  file or stdin) for features with children.
- **Indexed ID fix**: A feature's indexed IDs (see `INDEXED_IDS` in `v0.3.10`)
  are now updated correctly when an indexed attribute is added, edited, or
  deleted.

## For more information

For more details on any of the changes mentioned as well as many more changes
that have been made, please reference the associated GitHub issues.

- Add CLI command to add features by @garrettjstevens in
  https://github.com/GMOD/Apollo3/pull/748
- Fix cases where indexed ID is modified or deleted by @garrettjstevens in
  https://github.com/GMOD/Apollo3/pull/747

**Full Changelog**: https://github.com/GMOD/Apollo3/compare/v0.3.10...v0.3.11
