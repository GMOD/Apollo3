import gff, { GFF3Comment, GFF3Feature, GFF3Sequence } from '@gmod/gff'
import { ClientDataStore, checkRegistry } from 'apollo-common'
import {
  AnnotationFeatureSnapshot,
  ApolloAssemblyI,
  CheckResultSnapshot,
} from 'apollo-mst'
import { getSnapshot } from 'mobx-state-tree'
import { nanoid } from 'nanoid'

export async function loadAssemblyIntoClient(
  assemblyId: string,
  gff3FileText: string,
  apolloDataStore: ClientDataStore,
) {
  const featuresAndSequences: (GFF3Feature | GFF3Sequence | GFF3Comment)[] =
    gff.parseStringSync(gff3FileText, {
      parseSequences: true,
      parseComments: true,
      parseDirectives: false,
      parseFeatures: true,
    })
  if (featuresAndSequences.length === 0) {
    throw new Error('No features found in GFF3 file')
  }

  let sequenceFeatureCount = 0
  let assembly = apolloDataStore.assemblies.get(assemblyId)
  if (!assembly) {
    assembly = apolloDataStore.addAssembly(assemblyId)
  }

  for (const seqLine of featuresAndSequences) {
    if (Array.isArray(seqLine)) {
      // regular feature
      const feature = createFeature(seqLine)

      const ref =
        assembly.refSeqs.get(feature.refSeq) ??
        assembly.addRefSeq(feature.refSeq, feature.refSeq)
      if (!ref.features.has(feature._id)) {
        ref.addFeature(feature)
      }
    } else if ('comment' in seqLine) {
      assembly.addComment(seqLine.comment)
    } else {
      sequenceFeatureCount++
      // sequence feature
      let ref = assembly.refSeqs.get(seqLine.id)
      if (!ref) {
        ref = assembly.addRefSeq(seqLine.id, seqLine.id, seqLine.description)
      }
      if (seqLine.description && !ref.description) {
        ref.setDescription(seqLine.description)
      }
      ref.addSequence({
        start: 0,
        stop: seqLine.sequence.length,
        sequence: seqLine.sequence,
      })
    }
  }

  if (sequenceFeatureCount === 0) {
    throw new Error('No embedded FASTA section found in GFF3')
  }

  const checkResults: CheckResultSnapshot[] = await checkFeatures(assembly)
  apolloDataStore.addCheckResults(checkResults)
  return assembly
}

export async function checkFeatures(
  assembly: ApolloAssemblyI,
): Promise<CheckResultSnapshot[]> {
  const checkResults: CheckResultSnapshot[] = []
  for (const ref of assembly.refSeqs.values()) {
    for (const feature of ref.features.values()) {
      for (const check of checkRegistry.getChecks().values()) {
        const result: CheckResultSnapshot[] = await check.checkFeature(
          getSnapshot(feature),
          async (start: number, stop: number) => ref.getSequence(start, stop),
        )
        checkResults.push(...result)
      }
    }
  }
  return checkResults
}

function createFeature(gff3Feature: GFF3Feature): AnnotationFeatureSnapshot {
  const [firstFeature] = gff3Feature
  const {
    attributes,
    child_features: childFeatures,
    end,
    phase,
    score,
    seq_id: refName,
    source,
    start,
    strand,
    type,
  } = firstFeature
  if (!refName) {
    throw new Error(
      `feature does not have seq_id: ${JSON.stringify(firstFeature)}`,
    )
  }
  if (!type) {
    throw new Error(
      `feature does not have type: ${JSON.stringify(firstFeature)}`,
    )
  }
  if (start === null) {
    throw new Error(
      `feature does not have start: ${JSON.stringify(firstFeature)}`,
    )
  }
  if (end === null) {
    throw new Error(
      `feature does not have end: ${JSON.stringify(firstFeature)}`,
    )
  }
  const feature: AnnotationFeatureSnapshot = {
    _id: nanoid(),
    gffId: '',
    refSeq: refName,
    type,
    start: start - 1,
    end,
  }
  if (gff3Feature.length > 1) {
    feature.discontinuousLocations = gff3Feature.map((f) => {
      const { end: subEnd, phase: locationPhase, start: subStart } = f
      if (subStart === null || subEnd === null) {
        throw new Error(
          `feature does not have start and/or end: ${JSON.stringify(f)}`,
        )
      }
      let parsedPhase: 0 | 1 | 2 | undefined
      if (locationPhase) {
        switch (locationPhase) {
          case '0': {
            parsedPhase = 0

            break
          }
          case '1': {
            parsedPhase = 1

            break
          }
          case '2': {
            parsedPhase = 2

            break
          }
          default: {
            throw new Error(`Unknown phase: "${locationPhase}"`)
          }
        }
      }
      return { start: subStart - 1, end: subEnd, phase: parsedPhase }
    })
  }
  if (strand) {
    if (strand === '+') {
      feature.strand = 1
    } else if (strand === '-') {
      feature.strand = -1
    } else {
      throw new Error(`Unknown strand: "${strand}"`)
    }
  }
  if (score !== null) {
    feature.score = score
  }
  if (phase) {
    switch (phase) {
      case '0': {
        feature.phase = 0

        break
      }
      case '1': {
        feature.phase = 1

        break
      }
      case '2': {
        feature.phase = 2

        break
      }
      default: {
        throw new Error(`Unknown phase: "${phase}"`)
      }
    }
  }

  if (childFeatures.length > 0) {
    const children: Record<string, AnnotationFeatureSnapshot> = {}
    for (const childFeature of childFeatures) {
      const child = createFeature(childFeature)
      children[child._id] = child
      // Add value to gffId
      child.attributes?._id
        ? (child.gffId = child.attributes._id.toString())
        : (child.gffId = child._id)
    }
    feature.children = children
  }
  if (source ?? attributes) {
    const attrs: Record<string, string[]> = {}
    if (source) {
      attrs.source = [source]
    }
    if (attributes) {
      for (const [key, val] of Object.entries(attributes)) {
        if (val) {
          const newKey = key.toLowerCase()
          if (newKey !== 'parent') {
            // attrs[key.toLowerCase()] = val
            switch (key) {
              case 'ID': {
                attrs._id = val
                break
              }
              case 'Name': {
                attrs.gff_name = val
                break
              }
              case 'Alias': {
                attrs.gff_alias = val
                break
              }
              case 'Target': {
                attrs.gff_target = val
                break
              }
              case 'Gap': {
                attrs.gff_gap = val
                break
              }
              case 'Derives_from': {
                attrs.gff_derives_from = val
                break
              }
              case 'Note': {
                attrs.gff_note = val
                break
              }
              case 'Dbxref': {
                attrs.gff_dbxref = val
                break
              }
              case 'Ontology_term': {
                const goTerms: string[] = []
                const otherTerms: string[] = []
                for (const v of val) {
                  if (v.startsWith('GO:')) {
                    goTerms.push(v)
                  } else {
                    otherTerms.push(v)
                  }
                }
                if (goTerms.length > 0) {
                  attrs['Gene Ontology'] = goTerms
                }
                if (otherTerms.length > 0) {
                  attrs.gff_ontology_term = otherTerms
                }
                break
              }
              case 'Is_circular': {
                attrs.gff_is_circular = val
                break
              }
              default: {
                attrs[key.toLowerCase()] = val
              }
            }
          }
        }
      }
    }
    feature.attributes = attrs
  }
  return feature
}
