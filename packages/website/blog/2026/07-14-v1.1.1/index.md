---
authors: garrettjstevens
---

# Version 1.1.1

We are excited to release version `v1.1.1` of Apollo 3. This is a small patch
release with a few fixes since `v1.1.0`.

<!-- truncate -->

## Bug fixes

### Creating an annotation in an existing gene

The gene selector in the "Create Apollo annotation" dialog now displays
correctly, so you can once again add a new annotation to an existing parent
gene.

### Transcript "trim" button

The "trim" button in the transcript details now finds the correct end location
even when the CDS contains a stop codon before the start codon.

### Lower server memory use when loading features

The collaboration server now streams features to the client as they are read
from the database instead of collecting them all first, which reduces memory use
on the server when loading features.

## For more information

For more details on any of the changes mentioned as well as many more changes
that have been made, please reference the associated GitHub issues.

- Fix "Create Apollo annotation" when selecting parent gene by @garrettjstevens
  in https://github.com/GMOD/Apollo3/pull/814
- Fix end location detection of transcript "trim" button (v2) by
  @garrettjstevens in https://github.com/GMOD/Apollo3/pull/815
- Stream result of getFeatures from server by @garrettjstevens in
  https://github.com/GMOD/Apollo3/pull/816

**Full Changelog**: https://github.com/GMOD/Apollo3/compare/v1.1.0...v1.1.1
