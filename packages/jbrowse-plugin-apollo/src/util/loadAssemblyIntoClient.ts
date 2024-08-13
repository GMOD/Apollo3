import { ClientDataStore } from '@apollo-annotation/common'
import { ApolloAssemblyI, CheckResultSnapshot } from '@apollo-annotation/mst'
import { gff3ToAnnotationFeature } from '@apollo-annotation/shared'
import gff, { GFF3Comment, GFF3Feature, GFF3Sequence } from '@gmod/gff'
// import { getSnapshot } from 'mobx-state-tree'
// import { ClientDataStore, checkRegistry } from 'apollo-common'

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
    assembly = apolloDataStore.addAssembly(assemblyId, 'InMemoryFileDriver')
  }

  for (const seqLine of featuresAndSequences) {
    if (Array.isArray(seqLine)) {
      // regular feature
      const feature = gff3ToAnnotationFeature(seqLine)

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

  const checkResults: CheckResultSnapshot[] = []
  // const checkResults: CheckResultSnapshot[] = await checkFeatures(assembly)
  apolloDataStore.addCheckResults(checkResults)
  return assembly
}

export async function checkFeatures(
  _assembly: ApolloAssemblyI,
): Promise<CheckResultSnapshot[]> {
  return []
  //   const checkResults: CheckResultSnapshot[] = []
  //   for (const ref of assembly.refSeqs.values()) {
  //     for (const feature of ref.features.values()) {
  //       for (const check of checkRegistry.getChecks().values()) {
  //         const result: CheckResultSnapshot[] = await check.checkFeature(
  //           getSnapshot(feature),
  //           async (start: number, stop: number) => ref.getSequence(start, stop),
  //         )
  //         checkResults.push(...result)
  //       }
  //     }
  //   }
  //   return checkResults
}
